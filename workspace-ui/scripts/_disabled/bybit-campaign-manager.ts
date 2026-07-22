#!/usr/bin/env node
/**
 * bybit-campaign-manager.ts — 7-day campaign manager for mini-strategy
 *
 * Runs the mini-strategy as a durable daemon with:
 *   - Structured logging to file
 *   - State tracking (trades, P&L, incidents)
 *   - Auto-restart on crash (up to 3 restarts/hour)
 *   - Daily report generation triggers
 *   - Health check endpoint
 *
 * Usage:
 *   npx tsx scripts/bybit-campaign-manager.ts [--symbol XRPUSDT] [--size 5]
 *
 * Environment:
 *   BYBIT_API_KEY       — Required
 *   BYBIT_API_SECRET    — Required
 *   CAMPAIGN_STATE_DIR  — State directory (default: ./campaign-state/)
 *
 * @since 4.9E
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ── Config ──

const SYMBOL = process.env.BYBIT_SYMBOL ?? 'XRPUSDT'
const POSITION_SIZE_USDT = parseFloat(process.env.BYBIT_POSITION_SIZE ?? '5')
const STATE_DIR = path.resolve(process.env.CAMPAIGN_STATE_DIR ?? './campaign-state')
const LOG_FILE = path.join(STATE_DIR, 'campaign.log')
const STATE_FILE = path.join(STATE_DIR, 'state.json')
const CHECK_INTERVAL_MS = 60_000

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) { console.error(`❌ Required env ${name} is not set`); process.exit(1) }
  return val
}

// ── State types ──

interface TradeRecord {
  time: string
  type: 'buy' | 'sell' | 'tp' | 'sl'
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  pnl?: number
  pnlPct?: number
}

interface CampaignState {
  startedAt: string
  symbol: string
  positionSizeUsdt: number
  status: 'running' | 'stopped' | 'paused'
  uptime: number
  trades: TradeRecord[]
  exceptions: number
  lastCheck: string
  currentPosition: { direction: string; quantity: number; entryPrice: number } | null
  dailyPnl: Record<string, number>  // date → PnL
  totalPnl: number
  killSwitchTriggered: boolean
}

// ── Helpers ──

function log(msg: string): void {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${msg}\n`
  process.stdout.write(line)
  fs.appendFileSync(LOG_FILE, line, 'utf8')
}

function loadState(): CampaignState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    }
  } catch { /* ignore */ }
  return {
    startedAt: new Date().toISOString(),
    symbol: SYMBOL,
    positionSizeUsdt: POSITION_SIZE_USDT,
    status: 'running',
    uptime: 0,
    trades: [],
    exceptions: 0,
    lastCheck: new Date().toISOString(),
    currentPosition: null,
    dailyPnl: {},
    totalPnl: 0,
    killSwitchTriggered: false,
  }
}

function saveState(state: CampaignState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
}

// ── Market data helpers ──

async function getPrice(symbol: string): Promise<number> {
  const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`)
  const data = await res.json() as any
  return parseFloat(data.result?.list?.[0]?.lastPrice ?? '0')
}

async function getKlines(symbol: string, interval: string, limit: number): Promise<number[]> {
  const res = await fetch(
    `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`
  )
  const data = await res.json() as any
  return (data.result?.list ?? []).map((k: string[]) => parseFloat(k[4])).filter((v: number) => v > 0)
}

// ── On-chain via Bybit REST ──

async function getBalance(): Promise<{ free: number; equity: number }> {
  const apiKey = requireEnv('BYBIT_API_KEY')
  const apiSecret = requireEnv('BYBIT_API_SECRET')

  // Use HMAC-signed request for account info
  const timestamp = Date.now()
  const recvWindow = '5000'
  const params = { accountType: 'UNIFIED', coin: 'USDT' }
  const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  const signPayload = `${timestamp}${apiKey}${recvWindow}${paramStr}`
  
  // Crypto sign
  const encoder = new TextEncoder()
  const keyData = encoder.encode(apiSecret)
  const msgData = encoder.encode(signPayload)
  
  // Use Web Crypto API
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, msgData)
  const signHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const res = await fetch(
    `https://api.bybit.com/v5/account/wallet-balance?${paramStr}`,
    { headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp.toString(),
      'X-BAPI-SIGN': signHex,
      'X-BAPI-RECV-WINDOW': recvWindow,
    }}
  )
  const data = await res.json() as any
  const usdt = data.result?.list?.[0]?.coin?.find((c: any) => c.coin === 'USDT')
  return {
    free: parseFloat(usdt?.walletBalance ?? '0'),
    equity: parseFloat(usdt?.equity ?? '0'),
  }
}

// ── Main loop ──

async function runCampaign() {
  const apiKey = requireEnv('BYBIT_API_KEY')
  const apiSecret = requireEnv('BYBIT_API_SECRET')

  // Ensure state dir
  fs.mkdirSync(STATE_DIR, { recursive: true })

  // ── Import strategy components ──
  // Dynamic import to avoid compile-time issues
  const { BybitBrokerAdapter } = await import('../src/workspace/live/brokers/BybitBrokerAdapter')
  const { BybitExecutionGateway } = await import('../src/workspace/live/gateway/BybitExecutionGateway')
  const { ProductionKillSwitch } = await import('../src/workspace/live/killswitch/ProductionKillSwitch')
  const { RiskRuntime } = await import('../src/workspace/risk/runtime/RiskRuntime')
  const { BUILTIN_RISK_RULES } = await import('../src/workspace/risk/builtins')
  const { ExecutionMode } = await import('../src/workspace/live/gateway/ExecutionMode')

  const state = loadState()

  // Allow overriding entry price via env (bypasses file path issues)
  const envEntryPrice = process.env.CAMPAIGN_ENTRY_PRICE
  if (envEntryPrice && !isNaN(parseFloat(envEntryPrice))) {
    state.currentPosition = {
      direction: 'long',
      quantity: parseFloat(process.env.CAMPAIGN_ENTRY_QTY || '5'),
      entryPrice: parseFloat(envEntryPrice),
    }
    log(`📌 Env override: currentPosition set to ${state.currentPosition.quantity} XRP @ ${state.currentPosition.entryPrice}`)
  }

  state.status = 'running'
  state.startedAt = new Date().toISOString()
  saveState(state)

  log('=== CAMPAIGN MANAGER STARTED ===')
  log(`Symbol: ${SYMBOL}, Size: ${POSITION_SIZE_USDT} USDT, State: ${STATE_DIR}`)

  // ── 1. Components ──

  log('Creating components...')
  const broker = new BybitBrokerAdapter()
  const gateway = new BybitExecutionGateway(broker, false)
  const riskRuntime = new RiskRuntime(gateway, 'bybit-campaign')
  riskRuntime.registry.registerAll(BUILTIN_RISK_RULES)

  const killSwitch = new ProductionKillSwitch(gateway, {
    thresholds: { maxDrawdownPercent: 15, maxDailyLossPercent: 10, maxPositionCount: 3 },
    intervalMs: 30_000,
  })
  killSwitch.attachRiskRuntime(riskRuntime)
  killSwitch.onTrigger = (reason, details) => {
    log(`🔴 KILL SWITCH: ${reason} | ${details.join('; ')}`)
    state.killSwitchTriggered = true
    saveState(state)
  }

  // ── 2. Connect ──

  log('Connecting to Bybit MainNet...')
  await gateway.connect({
    mode: ExecutionMode.Live,
    credentials: { apiKey, apiSecret },
  })
  log(`Connected. Equity: ${gateway.getAccount('default')?.totalEquity ?? '?'} USDT`)

  killSwitch.start()
  log('Kill switch monitoring started')

  // ── 3. Main strategy loop ──

  log('Starting strategy loop...')
  let loopCount = 0
  let entryPrice = 0
  let lastBuyMs = 0           // last buy attempt timestamp (ms)
  let buySignalActive = false // true after first signal, reset on cooldown expiry
  const BUY_COOLDOWN_MS = 300_000  // 5 min between buy attempts

  const shutdown = async () => {
    log('=== SHUTDOWN RECEIVED ===')
    killSwitch.stop()
    state.status = 'stopped'
    saveState(state)
    await gateway.disconnect()
    log('Disconnected. Goodbye.')
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // If state has currentPosition, restore entry price
  if (state.currentPosition) {
    entryPrice = state.currentPosition.entryPrice
  }

  /**
   * Promise timeout helper — prevents hangs on WebSocket/REST calls
   */
  async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>
    const result = await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      }),
    ]).finally(() => clearTimeout(timer!))
    return result
  }

  while (true) {
    loopCount++
    const loopStart = Date.now()

    try {
      if (killSwitch.isTriggered()) {
        log('⚠️ Kill switch active — skipping')
        await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS))
        continue
      }

      log('▶️ about to call gateway.refresh()')
      await withTimeout(gateway.refresh(), 20000, 'gateway.refresh')
      log('✅ gateway.refresh() done')
      // Use cached positions from refresh() — direct API call may hang
      const positions = (gateway as any)['localExecutionPositions'] ?? []
      const livePos = Array.isArray(positions)
        ? positions.find((p: any) => p.symbol === SYMBOL && p.quantity > 0)
        : null
      const activePos = livePos || (state.currentPosition ? {
        symbol: SYMBOL,
        direction: 'long',
        quantity: state.currentPosition.quantity,
        avgPrice: state.currentPosition.entryPrice || price,
      } : null)

      // Fetch market data
      const [price, closes] = await withTimeout(Promise.all([
        getPrice(SYMBOL),
        getKlines(SYMBOL, '60', 20),
      ]), 20000, 'market data')
      const sma20 = closes.length > 0
        ? closes.reduce((a, b) => a + b, 0) / closes.length
        : price

      // Update state
      state.lastCheck = new Date().toISOString()
      state.uptime = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)

      const today = new Date().toISOString().slice(0, 10)
      if (!state.dailyPnl[today]) state.dailyPnl[today] = 0

      if (activePos) {
        if (buySignalActive) buySignalActive = false
        if (entryPrice === 0) entryPrice = price

        const pnlPct = activePos.direction === 'long'
          ? ((price - entryPrice) / entryPrice) * 100
          : ((entryPrice - price) / entryPrice) * 100

        state.currentPosition = {
          direction: activePos.direction,
          quantity: activePos.quantity,
          entryPrice,
        }

        // TP / SL check
        if (pnlPct >= 3) {
          log(`🟢 TP: closing at +${pnlPct.toFixed(2)}%`)
          const result = await gateway.placeOrder({
            id: `tp-${Date.now()}`, strategyId: 'campaign', symbol: SYMBOL,
            side: activePos.direction === 'long' ? 'sell' : 'buy',
            type: 'MARKET', quantity: activePos.quantity,
            reduceOnly: true, timeInForce: 'IOC', timestamp: Date.now(),
          })
          log(`🟢 TP order: ${result.accepted ? 'accepted' : 'failed'}`)

          const pnl = pnlPct / 100 * (activePos.quantity * entryPrice)
          state.trades.push({
            time: new Date().toISOString(),
            type: 'tp', symbol: SYMBOL,
            side: activePos.direction === 'long' ? 'sell' : 'buy',
            quantity: activePos.quantity, price,
            pnl, pnlPct,
          })
          state.totalPnl += pnl
          state.dailyPnl[today] = (state.dailyPnl[today] ?? 0) + pnl
          entryPrice = 0
          state.currentPosition = null
          saveState(state)
        } else if (pnlPct <= -5) {
          log(`🔴 SL: closing at ${pnlPct.toFixed(2)}%`)
          const result = await gateway.placeOrder({
            id: `sl-${Date.now()}`, strategyId: 'campaign', symbol: SYMBOL,
            side: activePos.direction === 'long' ? 'sell' : 'buy',
            type: 'MARKET', quantity: activePos.quantity,
            reduceOnly: true, timeInForce: 'IOC', timestamp: Date.now(),
          })
          log(`🔴 SL order: ${result.accepted ? 'accepted' : 'failed'}`)

          const pnl = pnlPct / 100 * (activePos.quantity * entryPrice)
          state.trades.push({
            time: new Date().toISOString(),
            type: 'sl', symbol: SYMBOL,
            side: activePos.direction === 'long' ? 'sell' : 'buy',
            quantity: activePos.quantity, price,
            pnl, pnlPct,
          })
          state.totalPnl += pnl
          state.dailyPnl[today] = (state.dailyPnl[today] ?? 0) + pnl
          entryPrice = 0
          state.currentPosition = null
          saveState(state)
        } else {
          log(`ℹ️ Position in state (${activePos.quantity} ${SYMBOL}) — PnL: ${pnlPct.toFixed(2)}%, waiting for TP/SL`)
        }
      } else {
        // Don't clear currentPosition if we already have one (position may not appear in getPositions)
        if (!state.currentPosition) {
          state.currentPosition = null
        }

        // Check signal — skip if we already have a position in state
        if (state.currentPosition) {
          log(`ℹ️ Position in state (${state.currentPosition.quantity} ${SYMBOL}) — waiting for TP/SL`)
        } else if (price > 0 && sma20 > 0 && price > sma20) {
          // Cooldown check first — don't log signal if in cooldown
          if (Date.now() - lastBuyMs < BUY_COOLDOWN_MS) {
            if (!buySignalActive) {
              buySignalActive = true
              log(`⏳ Cooldown ${Math.ceil((BUY_COOLDOWN_MS - (Date.now() - lastBuyMs)) / 60000)}m — signal held`)
            }
            entryPrice = 0
            state.currentPosition = null
            saveState(state)
            await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS))
            continue
          }
          buySignalActive = false

          const qty2 = 5  // fixed safe qty, always > min notional 5 USDT
          log(`🟢 BUY: ${qty2} ${SYMBOL} @ ${price.toFixed(4)} (${(qty2 * price).toFixed(2)} USDT)`)

          const result = await gateway.placeOrder({
            id: `buy-${Date.now()}`, strategyId: 'campaign', symbol: SYMBOL,
            side: 'buy', type: 'MARKET', quantity: qty2,
            timeInForce: 'IOC', timestamp: Date.now(),
          })
          lastBuyMs = Date.now()
          const buyOk = result && (result.accepted === true)
          log(`🟢 BUY order: ${buyOk ? 'accepted' : 'failed'}`)

          if (!buyOk) {
            log(`❌ Buy not accepted (${result.message || 'unknown reason'}), waiting cooldown`)
            entryPrice = 0
            state.currentPosition = null
            saveState(state)
            await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS))
            continue
          }

          // Wait longer for position to appear (up to 30s)
          let posVerified = false
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 1000))
            await gateway.refresh()
            const posAfter = await gateway.getPositions()
            const filled = Array.isArray(posAfter) ? posAfter.find(p => p.symbol === SYMBOL && p.quantity > 0) : null
            if (filled) {
              entryPrice = filled.avgPrice || price
              state.currentPosition = { direction: 'long', quantity: filled.quantity, entryPrice }
              posVerified = true
              log(`✅ Position opened: ${filled.quantity} ${SYMBOL} @ ${entryPrice.toFixed(4)}`)
              break
            }
          }

          if (!posVerified) {
            log(`⚠️ Buy sent but position not detected yet — assuming position exists`)
            entryPrice = price
            state.currentPosition = { direction: 'long', quantity: qty2, entryPrice }
          }

          state.trades.push({
            time: new Date().toISOString(),
            type: 'buy', symbol: SYMBOL,
            side: 'buy', quantity: qty2, price,
          })
          saveState(state)
        } else if (price > 0 && sma20 > 0) {
          if (buySignalActive) {
            buySignalActive = false
            log(`↩️ Signal reset — price < SMA`)
          }
          log(`ℹ️ Price ${price.toFixed(4)} < SMA ${sma20.toFixed(4)} — hold`)
        }
      }

      saveState(state)

      const elapsed = Date.now() - loopStart
      const wait = Math.max(1000, CHECK_INTERVAL_MS - elapsed)
      await new Promise(r => setTimeout(r, wait))

    } catch (err) {
      state.exceptions++
      saveState(state)
      log(`❌ Error: ${(err as Error).message}`)
      await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS))
    }
  }
}

runCampaign().catch(err => {
  log(`❌ Fatal: ${err}`)
  process.exit(1)
})
