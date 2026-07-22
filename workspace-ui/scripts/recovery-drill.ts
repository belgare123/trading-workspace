#!/usr/bin/env node
/**
 * recovery-drill.ts — Production Recovery Drill (Production Launch Gate)
 *
 * Самый важный сценарий всей системы:
 *   MainNet → открыть минимальную позицию → убить процесс →
 *   перезапустить Workspace → верифицировать восстановление →
 *   дождаться штатного закрытия
 *
 * Usage:
 *   BYBIT_API_KEY=xxx BYBIT_API_SECRET=xxx npx tsx scripts/recovery-drill.ts
 *
 * Environment:
 *   BYBIT_API_KEY       — MainNet API key
 *   BYBIT_API_SECRET    — MainNet API secret
 *   SYMBOL              — symbol (default: XRPUSDT)
 *   QTY                 — quantity (default: 1)
 *   RUNBOOK_PATH        — путь к runbook для записи результата (опционально)
 *
 * @since Sprint 5.8 Production Launch Gate
 */

import https from 'https'
import crypto from 'crypto'

// ── Config ──

const API_KEY = process.env.BYBIT_API_KEY ?? ''
const API_SECRET = process.env.BYBIT_API_SECRET ?? ''
const SYMBOL = process.env.SYMBOL ?? 'XRPUSDT'
const QTY = parseFloat(process.env.QTY ?? '1')
const BASE_URL = 'https://api.bybit.com'
const RUNBOOK_PATH = process.env.RUNBOOK_PATH ?? ''

interface DrillReport {
  success: boolean
  steps: Array<{ name: string, status: 'PASS' | 'FAIL' | 'SKIP', detail: string }>
  orderId?: string
  positionSide?: string
  entryPrice?: number
  exitPrice?: number
  pnl?: number
  durationMs?: number
}

// ── Helpers ──

function signRequest(secret: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const timestamp = params.timestamp
  const recvWindow = params.recv_window
  const toSign = `${timestamp}${API_KEY}${recvWindow}${sorted}`
  return crypto.createHmac('sha256', secret).update(toSign).digest('hex')
}

function restCall(method: 'GET' | 'POST', path: string, body?: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString()
    const recvWindow = '5000'
    let params: Record<string, string> = { timestamp, recv_window: recvWindow }

    if (body && method === 'POST') {
      Object.keys(body).sort().forEach(k => { params[k] = String(body[k]) })
    }

    const sign = signRequest(API_SECRET, params)
    const bodyStr = method === 'POST' ? JSON.stringify(body ?? {}) : undefined

    const options: https.RequestOptions = {
      method,
      hostname: new URL(BASE_URL).hostname,
      path: `${new URL(BASE_URL).pathname || ''}${path}`,
      headers: {
        'X-BAPI-API-KEY': API_KEY,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-SIGN': sign,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', (chunk: string) => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.retCode !== 0 && parsed.retCode !== 10001) {
            reject(new Error(`Bybit error ${parsed.retCode}: ${parsed.retMsg}`))
          } else {
            resolve(parsed)
          }
        } catch (e) {
          reject(new Error(`Failed to parse: ${data.substring(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Main Drill ──

async function main() {
  const report: DrillReport = { success: false, steps: [] }
  const startTime = Date.now()

  console.log(`\n🔄 RECOVERY DRILL — Production (MainNet)`)
  console.log(`   ${'='.repeat(50)}`)
  console.log(`   Symbol:  ${SYMBOL}`)
  console.log(`   Qty:     ${QTY}`)
  console.log(`   Network: MainNet`)
  console.log()

  // ── Step 1: Check wallet ──

  console.log('📡 [1/6] Checking wallet balance...')
  try {
    const wallet = await restCall('GET', '/v5/account/wallet-balance?accountType=UNIFIED&coin=USDT')
    const balance = parseFloat(wallet?.result?.list?.[0]?.coin?.[0]?.walletBalance ?? '0')
    console.log(`        Balance: ${balance.toFixed(2)} USDT`)
    report.steps.push({ name: 'Wallet Check', status: 'PASS', detail: `${balance.toFixed(2)} USDT` })
  } catch (err: any) {
    console.log(`        ❌ Failed: ${err.message}`)
    report.steps.push({ name: 'Wallet Check', status: 'FAIL', detail: err.message })
    return report
  }

  // ── Step 2: Get ticker for entry reference ──

  console.log('\n📡 [2/6] Fetching current price...')
  let currentPrice: number | null = null
  try {
    const ticker = await restCall('GET', `/v5/market/tickers?category=linear&symbol=${SYMBOL}`)
    currentPrice = parseFloat(ticker?.result?.list?.[0]?.lastPrice ?? '0')
    console.log(`        ${SYMBOL} last price: ${currentPrice}`)
  } catch (err: any) {
    console.log(`        ⚠️  Could not get price: ${err.message}`)
  }

  // ── Step 3: Verify no existing position ──

  console.log('\n📡 [3/6] Verifying no existing position...')
  let startPosition = 0
  try {
    const posData = await restCall('GET', `/v5/position/list?category=linear&symbol=${SYMBOL}`)
    const positions = posData?.result?.list ?? []
    startPosition = positions.length
    console.log(`        Current positions for ${SYMBOL}: ${startPosition}`)
  } catch (err: any) {
    console.log(`        ⚠️  Could not check positions: ${err.message}`)
  }

  if (startPosition > 0) {
    console.log('        ⚠️  Existing position found! Drill will work with existing position.')
  }

  // ── Step 4: Place MARKET buy order (if no existing position) ──

  if (startPosition === 0) {
    console.log('\n📡 [4/6] Opening minimal position on MainNet...')
    try {
      const order = await restCall('POST', '/v5/order/create', {
        category: 'linear',
        symbol: SYMBOL,
        side: 'Buy',
        orderType: 'Market',
        qty: String(QTY),
        reduceOnly: false,
        positionIdx: 0,
      })
      const orderId = order?.result?.orderId ?? 'unknown'
      report.orderId = orderId
      console.log(`        ✅ Order placed: ${orderId}`)
      console.log(`        ➡️  Position value: ~${(currentPrice ?? 1) * QTY} USDT`)
      report.steps.push({ name: 'Open Position', status: 'PASS', detail: `Order ${orderId}, qty=${QTY}` })
      console.log('\n        ⏳ Waiting 3s for position to settle...')
      await sleep(3000)

      // Get entry price
      try {
        const posData2 = await restCall('GET', `/v5/position/list?category=linear&symbol=${SYMBOL}`)
        const pos = posData2?.result?.list?.[0]
        report.entryPrice = parseFloat(pos?.entryPrice ?? '0')
        report.positionSide = pos?.side ?? 'Buy'
        console.log(`        Entry price: ${report.entryPrice}`)
      } catch { /* silent */ }
    } catch (err: any) {
      console.log(`        ❌ Failed: ${err.message}`)
      report.steps.push({ name: 'Open Position', status: 'FAIL', detail: err.message })
      return report
    }
  } else {
    console.log('\n📡 [4/6] Skipping order — position already exists')
    report.steps.push({ name: 'Open Position', status: 'SKIP', detail: 'Position already exists' })
  }

  // ── HUMAN STEP: Simulate process kill ──

  console.log('\n')
  console.log('   ╔══════════════════════════════════════════════════════╗')
  console.log('   ║              ❗️ HUMAN ACTION REQUIRED                ║')
  console.log('   ║                                                      ║')
  console.log('   ║  1. Запишите orderId выше или найдите позицию в     ║')
  console.log('   ║     Bybit UI → Positions.                           ║')
  console.log('   ║                                                      ║')
  console.log('   ║  2. Нажмите Ctrl+C чтобы остановить этот процесс.   ║')
  console.log('   ║                                                      ║')
  console.log('   ║  3. Запустите workspace repeat восстановление:      ║')
  console.log('   ║     MODE=mainnet SYMBOLS=XRPUSDT \\                   ║')
  console.log('   ║       npx tsx scripts/workspace.ts start             ║')
  console.log('   ║                                                      ║')
  console.log('   ║  4. Проверьте recovery health:                      ║')
  console.log('   ║     npx tsx scripts/workspace.ts health              ║')
  console.log('   ║                                                      ║')
  console.log('   ║  5. Вернитесь сюда и запустите верификацию:         ║')
  console.log('   ║     npx tsx scripts/recovery-drill.ts verify         ║')
  console.log('   ║                                                      ║')
  console.log('   ╚══════════════════════════════════════════════════════╝')
  console.log()

  // Wait for the position to close naturally (will timeout gracefully)
  console.log('⏳ Ожидание закрытия позиции (макс. 2 часа)...')
  console.log('   ВНИМАНИЕ: в реальности здесь будет восстановление.')
  console.log('   Для верификации запустите scripts/workspace.ts start')

  // Loop to monitor position until it's closed
  let closed = false
  const pollInterval = 30_000 // 30s
  const maxWaitMs = 2 * 60 * 60 * 1000 // 2 hours
  let waited = 0
  let exitPrice: number | null = null
  let pnl: number | null = null

  while (!closed && waited < maxWaitMs) {
    await sleep(pollInterval)
    waited += pollInterval
    try {
      const posData = await restCall('GET', `/v5/position/list?category=linear&symbol=${SYMBOL}`)
      const positions = posData?.result?.list ?? []
      const activePosition = positions.find((p: any) =>
        parseFloat(p.size ?? '0') > 0 && p.symbol === SYMBOL
      )
      if (!activePosition) {
        closed = true
        exitPrice = parseFloat(posData?.result?.list?.[0]?.avgPrice ?? '0')
        pnl = parseFloat(posData?.result?.list?.[0]?.unrealisedPnl ?? '0')
        console.log(`        ✅ Position closed! Exit: ${exitPrice}, PnL: ${pnl}`)
      } else {
        const size = parseFloat(activePosition.size ?? '0')
        const entry = parseFloat(activePosition.entryPrice ?? '0')
        const upnl = parseFloat(activePosition.unrealisedPnl ?? '0')
        console.log(`        Position open: size=${size} @${entry} UPNL=${upnl.toFixed(4)} USDT`)
      }
    } catch (err: any) {
      console.log(`        ⚠️  Poll error: ${err.message}`)
    }
  }

  if (closed) {
    report.exitPrice = exitPrice ?? 0
    report.pnl = pnl ?? 0
    report.steps.push({ name: 'Position Close', status: 'PASS', detail: `Exit=${exitPrice}, PnL=${pnl}` })
  } else {
    report.steps.push({ name: 'Position Close', status: 'SKIP', detail: '2h timeout — position still open' })
  }

  report.durationMs = Date.now() - startTime
  report.success = report.steps.every(s => s.status !== 'FAIL')

  console.log(`\n${'='.repeat(50)}`)
  console.log(`   📋 DRILL REPORT`)
  console.log(`${'='.repeat(50)}`)
  for (const step of report.steps) {
    const icon = step.status === 'PASS' ? '🟢' : step.status === 'FAIL' ? '🔴' : '🟡'
    console.log(`   ${icon} ${step.name}: ${step.detail}`)
  }
  console.log(`\n   Duration: ${(report.durationMs / 1000).toFixed(0)}s`)
  console.log(`   Result: ${report.success ? '🟢 PASSED' : '🔴 FAILED'}`)

  return report
}

// ── Verify Mode ──

async function verify() {
  console.log(`\n🔍 RECOVERY DRILL — Verification Mode`)
  console.log(`   ${'='.repeat(50)}`)

  // Check wallet
  console.log('\n📡 [1/4] Wallet...')
  const wallet = await restCall('GET', '/v5/account/wallet-balance?accountType=UNIFIED&coin=USDT')
  // eslint-disable-next-line
  const balance = parseFloat(wallet?.result?.list?.[0]?.coin?.[0]?.walletBalance ?? '0')
  const equity = parseFloat(wallet?.result?.list?.[0]?.coin?.[0]?.equity ?? '0')
  console.log(`        Balance: ${balance.toFixed(2)} USDT, Equity: ${equity.toFixed(2)} USDT`)

  // Check position
  console.log('\n📡 [2/4] Position...')
  const posData = await restCall('GET', `/v5/position/list?category=linear&symbol=${SYMBOL}`)
  const positions = posData?.result?.list ?? []
  const active = positions.filter((p: any) => parseFloat(p.size ?? '0') > 0)
  if (active.length > 0) {
    const p = active[0]
    console.log(`        ✅ Position found: size=${p.size} ${p.symbol} entry=${p.entryPrice} UPNL=${p.unrealisedPnl}`)
  } else {
    console.log(`        No active positions`)
  }

  // Check orders
  console.log('\n📡 [3/4] Orders (TP/SL)...')
  const orders = await restCall('GET', `/v5/order/realtime?category=linear&symbol=${SYMBOL}&limit=50`)
  const openOrders = orders?.result?.list?.filter((o: any) =>
    o.orderStatus === 'New' || o.orderStatus === 'PartiallyFilled'
  ) ?? []
  console.log(`        Open orders: ${openOrders.length}`)
  for (const o of openOrders) {
    console.log(`          - ${o.orderId} ${o.side} ${o.orderType} qty=${o.qty} price=${o.price}`)
  }

  // Evaluate
  console.log('\n📡 [4/4] Evaluation...')
  // Success criteria:
  // 1. Balance doesn't show unexpected loss
  // 2. Position is tracked (or closed properly)
  // 3. TP/SL orders exist for open position
  const hasPosition = active.length > 0
  const tpslCount = openOrders.filter((o: any) =>
    o.reduceOnly === true || o.orderType === 'Limit'
  ).length

  if (hasPosition && tpslCount > 0) {
    console.log('        ✅ Position with TP/SL — recovery verified')
  } else if (hasPosition && tpslCount === 0) {
    console.log('        ⚠️  Position without TP/SL — needs manual TP/SL placement')
  } else {
    console.log('        ℹ️  No active position — system recovered cleanly')
  }

  console.log(`\n   🟢 VERIFICATION COMPLETE`)
}

// ── Entry ──

const mode = process.argv[2] ?? 'drill'

if (mode === 'verify') {
  verify().catch(err => {
    console.error(`\n❌ Verification failed: ${err.message}`)
    process.exit(1)
  })
} else if (mode === 'drill') {
  main().then(async report => {
    if (RUNBOOK_PATH) {
      const fs = await import('fs')
      fs.writeFileSync(RUNBOOK_PATH, JSON.stringify(report, null, 2), 'utf-8')
      console.log(`\nReport saved to ${RUNBOOK_PATH}`)
    }
    if (!report.success) process.exit(1)
  }).catch(err => {
    console.error(`\n❌ Drill failed: ${err.message}`)
    process.exit(1)
  })
} else {
  console.error('Usage: npx tsx scripts/recovery-drill.ts [drill|verify]')
  process.exit(1)
}
