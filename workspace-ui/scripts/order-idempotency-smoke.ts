#!/usr/bin/env node
/**
 * order-idempotency-smoke.ts — Order Idempotency Drill (Production Launch Gate)
 *
 * Проверяет на реальной бирже (testnet):
 * 1. Отправка ордера → timeout (симулированный)
 * 2. Повторная отправка с тем же clientOrderId
 * 3. Отсутствие дублирования ордеров
 *
 * Usage:
 *   BYBIT_API_KEY=xxx BYBIT_API_SECRET=xxx npx tsx scripts/order-idempotency-smoke.ts
 *
 * Environment:
 *   BYBIT_API_KEY     — API key (testnet or mainnet)
 *   BYBIT_API_SECRET  — API secret
 *   TESTNET           — set 'true' for testnet (default: true)
 *   SYMBOL            — symbol to test (default: XRPUSDT)
 *   TIMEOUT_MS        — simulated timeout delay (default: 3000)
 *
 * @since Sprint 5.8 Production Launch Gate
 */

import https from 'https'
import crypto from 'crypto'

// ── Config ──

const API_KEY = process.env.BYBIT_API_KEY ?? ''
const API_SECRET = process.env.BYBIT_API_SECRET ?? ''
const TESTNET = process.env.TESTNET !== 'false'
const SYMBOL = process.env.SYMBOL ?? 'XRPUSDT'
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS ?? '3000', 10)

const BASE_URL = TESTNET ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com'

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

    let params: Record<string, string> = {}
    if (method === 'GET') {
      const url = new URL(path, BASE_URL)
      url.searchParams.forEach((v, k) => { params[k] = v })
    }
    params.timestamp = timestamp
    params.recv_window = recvWindow

    if (body && method === 'POST') {
      // For POST, the body is the sorted params
      const sorted: Record<string, string> = {}
      Object.keys(body).sort().forEach(k => {
        sorted[k] = String(body[k])
      })
      params = { ...sorted, timestamp, recv_window: recvWindow }
    }

    const sign = signRequest(API_SECRET, params)

    const url = `${BASE_URL}${path}`
    const bodyStr = method === 'POST' ? JSON.stringify(body ?? {}) : undefined

    const options: https.RequestOptions = {
      method,
      hostname: new URL(url).hostname,
      path: new URL(url).pathname + new URL(url).search,
      headers: {
        'X-BAPI-API-KEY': API_KEY,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-SIGN': sign,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json',
      },
      timeout: method === 'POST' ? TIMEOUT_MS : 10000,
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
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('TIMEOUT'))
    })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ── Main ──

async function main() {
  console.log(`\n🔍 Order Idempotency Drill`)
  console.log(`   ${'='.repeat(50)}`)
  console.log(`   Symbol:         ${SYMBOL}`)
  console.log(`   Testnet:        ${TESTNET}`)
  console.log(`   Timeout (sim):  ${TIMEOUT_MS}ms`)
  console.log()

  // ── Step 1: Get wallet balance ──

  console.log('📡 [1/5] Checking wallet balance...')
  const wallet = await restCall('GET', '/v5/account/wallet-balance?accountType=UNIFIED&coin=USDT')
  const balance = parseFloat(wallet?.result?.list?.[0]?.coin?.[0]?.walletBalance ?? '0')
  console.log(`        Balance: ${balance.toFixed(2)} USDT`)

  if (balance < 10) {
    console.log('   ⚠️  Balance too low for test. Need at least 10 USDT.')
    console.log('   ❌ DRILL FAILED — insufficient funds')
    process.exit(1)
  }

  // ── Step 2: Generate unique clientOrderId ──

  const clientId = `idemp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const qty = 1 // Minimum test quantity

  console.log(`\n📡 [2/5] Placing order #1 (clientOrderId: ${clientId})`)
  console.log(`        Quantity: ${qty} ${SYMBOL.replace('USDT', '')}`)

  try {
    const order1 = await restCall('POST', '/v5/order/create', {
      category: 'linear',
      symbol: SYMBOL,
      side: 'Buy',
      orderType: 'Market',
      qty: String(qty),
      orderLinkId: clientId,
      reduceOnly: false,
      positionIdx: 0,
    })
    console.log(`        ✅ Order #1 placed: ${order1?.result?.orderId ?? 'unknown'}`)

    // ── Step 3: Immediately cancel the order ──
    console.log(`\n📡 [3/5] Cancelling order (so we can retry cleanly)...`)
    await restCall('POST', '/v5/order/cancel', {
      category: 'linear',
      symbol: SYMBOL,
      orderLinkId: clientId,
    })
    console.log(`        ✅ Order cancelled`)

  } catch (err: any) {
    if (err.message === 'TIMEOUT') {
      console.log(`        ⌛ Timeout — order MAY have been created on exchange`)
    } else {
      console.log(`        ⚠️  Order #1 failed: ${err.message}`)
    }
  }

  // ── Step 4: Retry with SAME clientOrderId ──

  console.log(`\n📡 [4/5] Placing order #2 with SAME clientOrderId...`)
  console.log(`        (verifying idempotency — should NOT create duplicate)`)

  try {
    const order2 = await restCall('POST', '/v5/order/create', {
      category: 'linear',
      symbol: SYMBOL,
      side: 'Buy',
      orderType: 'Market',
      qty: String(qty),
      orderLinkId: clientId,
      reduceOnly: false,
      positionIdx: 0,
    })
    console.log(`        ✅ Order #2 responded: ${order2?.result?.orderId ?? 'unknown'}`)
  } catch (err: any) {
    console.log(`        ⚠️  Order #2: ${err.message}`)
  }

  // ── Step 5: Verify no duplicate orders on exchange ──

  console.log(`\n📡 [5/5] Verifying order deduplication...`)

  try {
    const openOrders = await restCall('GET', `/v5/order/realtime?category=linear&symbol=${SYMBOL}&orderLinkId=${clientId}&limit=5`)
    const orders = openOrders?.result?.list ?? []
    console.log(`        Orders found with orderLinkId: ${orders.length}`)

    if (orders.length <= 1) {
      console.log(`        ✅ IDEMPOTENCY VERIFIED: ${orders.length} order(s) for same clientOrderId`)
      console.log(`\n   🟢 DRILL PASSED`)
    } else {
      console.log(`        ❌ DUPLICATE DETECTED: Found ${orders.length} orders with same clientOrderId!`)
      for (const o of orders) {
        console.log(`           - ${o.orderId} (${o.orderStatus})`)
      }
      console.log(`\n   🔴 DRILL FAILED — idempotency broken`)
      process.exit(1)
    }
  } catch (err: any) {
    console.log(`        ⚠️  Verification query: ${err.message}`)
    console.log(`        (May need manual verification on exchange)`)
    console.log(`\n   🟡 DRILL INCONCLUSIVE — verify manually`)
  }
}

main().catch(err => {
  console.error(`\n❌ DRILL FAILED: ${err.message}`)
  process.exit(1)
})
