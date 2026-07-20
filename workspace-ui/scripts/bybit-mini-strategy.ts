#!/usr/bin/env node
/**
 * bybit-mini-strategy.ts — Mini Live Strategy on Bybit MainNet
 *
 * Runs a simple 1-position strategy with:
 *   - Small capital (5-10 USDT per trade)
 *   - Single position at a time
 *   - ProductionKillSwitch protection
 *   - Continuous 24/7 operation
 *
 * Strategy: Simple SMA-based trend following on XRPUSDT
 *   - Every 60s: fetch 1h klines, compute SMA(20)
 *   - No position: if price > SMA → BUY (long)
 *   - Has position: close at TP (+3%) or SL (-5%)
 *   - Kill switch: 15% drawdown or 10% daily loss
 *
 * Usage:
 *   npx tsx scripts/bybit-mini-strategy.ts
 *
 * Environment:
 *   BYBIT_API_KEY       — Required: Bybit MainNet API key
 *   BYBIT_API_SECRET    — Required: Bybit MainNet API secret
 *   BYBIT_SYMBOL        — Symbol (default: XRPUSDT)
 *   BYBIT_POSITION_SIZE — Position size in USDT (default: 5)
 *
 * @since 4.9E
 */

import { ExecutionMode } from '../src/workspace/live/gateway/ExecutionMode'
import { BybitBrokerAdapter } from '../src/workspace/live/brokers/BybitBrokerAdapter'
import { BybitExecutionGateway } from '../src/workspace/live/gateway/BybitExecutionGateway'
import { ProductionKillSwitch } from '../src/workspace/live/killswitch/ProductionKillSwitch'
import { RiskRuntime } from '../src/workspace/risk/runtime/RiskRuntime'
import { BUILTIN_RISK_RULES } from '../src/workspace/risk/builtins'

// ── Config ──

const SYMBOL = process.env.BYBIT_SYMBOL ?? 'XRPUSDT'
const POSITION_SIZE_USDT = parseFloat(process.env.BYBIT_POSITION_SIZE ?? '5')
const CHECK_INTERVAL_MS = 60_000
const STOP_LOSS_PCT = 5
const TAKE_PROFIT_PCT = 3
const KILL_DRAWDOWN = 15
const KILL_DAILY_LOSS = 10

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) { console.error(`❌ Required env ${name} is not set`); process.exit(1) }
  return val
}

function log(level: string, msg: string): void {
  console.log(`[${new Date().toISOString()}] [${level}] ${msg}`)
}

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

async function main() {
  const apiKey = requireEnv('BYBIT_API_KEY')
  const apiSecret = requireEnv('BYBIT_API_SECRET')

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   Bybit Mini Strategy — Live MainNet Trading    ║')
  console.log('║   Sprint 4.9E — 1 position, small capital       ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()
  console.log(`Symbol:         ${SYMBOL}`)
  console.log(`Position size:  ${POSITION_SIZE_USDT} USDT`)
  console.log(`Check interval: ${CHECK_INTERVAL_MS / 1000}s`)
  console.log(`Stop loss:      -${STOP_LOSS_PCT}%`)
  console.log(`Take profit:    +${TAKE_PROFIT_PCT}%`)
  console.log(`Kill drawdown:  ${KILL_DRAWDOWN}%`)
  console.log()

  // ── 1. Components ──

  log('INFO', 'Creating components...')
  const broker = new BybitBrokerAdapter()
  const gateway = new BybitExecutionGateway(broker, false)
  const riskRuntime = new RiskRuntime(gateway, 'bybit-mini')
  riskRuntime.registry.registerAll(BUILTIN_RISK_RULES)

  const killSwitch = new ProductionKillSwitch(gateway, {
    thresholds: { maxDrawdownPercent: KILL_DRAWDOWN, maxDailyLossPercent: KILL_DAILY_LOSS, maxPositionCount: 3 },
    intervalMs: 30_000,
  })
  killSwitch.attachRiskRuntime(riskRuntime)
  killSwitch.onTrigger = (reason, details) => log('🔴 KILL SWITCH', `${reason} | ${details.join('; ')}`)

  // ── 2. Connect ──

  log('INFO', `Connecting to Bybit MainNet (${SYMBOL})...`)
  await gateway.connect({
    mode: ExecutionMode.Live,
    credentials: { apiKey, apiSecret },
  })
  log('INFO', `Connected. Equity: ${gateway.getAccount('default')?.totalEquity ?? '?'} USDT`)

  // ── 3. Start kill switch ──

  killSwitch.start()
  log('INFO', 'Kill switch monitoring started')

  // ── 4. Strategy loop ──

  log('INFO', 'Starting strategy loop...')
  console.log()

  let entryPrice = 0

  const shutdown = async () => {
    log('SHUTDOWN', 'Received signal, stopping...')
    killSwitch.stop()
    await gateway.disconnect()
    log('SHUTDOWN', 'Disconnected.')
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  while (true) {
    try {
      if (killSwitch.isTriggered()) {
        log('⚠️', 'Kill switch active — waiting')
        await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS))
        continue
      }

      await gateway.refresh()
      const positions = await gateway.getPositions()
      const activePos = Array.isArray(positions)
        ? positions.find(p => p.symbol === SYMBOL && p.quantity > 0)
        : null

      // ── Get market data ──

      const [price, closes] = await Promise.all([
        getPrice(SYMBOL),
        getKlines(SYMBOL, '60', 20),
      ])
      const sma20 = closes.length > 0
        ? closes.reduce((a, b) => a + b, 0) / closes.length
        : price

      if (activePos) {
        // ── Has position — check TP / SL ──

        if (entryPrice === 0) entryPrice = price // first tick after entry

        const pnlPct = activePos.direction === 'long'
          ? ((price - entryPrice) / entryPrice) * 100
          : ((entryPrice - price) / entryPrice) * 100

        log('📊', `${activePos.direction.toUpperCase()} ${activePos.quantity.toFixed(2)} @ ${entryPrice.toFixed(4)} PnL=${pnlPct.toFixed(2)}%`)

        if (pnlPct >= TAKE_PROFIT_PCT) {
          log('🟢 TP', `Closing at +${pnlPct.toFixed(2)}%`)
          const result = await gateway.placeOrder({
            id: `tp-${Date.now()}`, strategyId: 'mini', symbol: SYMBOL,
            side: activePos.direction === 'long' ? 'sell' : 'buy',
            type: 'MARKET', quantity: activePos.quantity,
            reduceOnly: true, timeInForce: 'IOC', timestamp: Date.now(),
          })
          log('🟢 TP', `Done: ${result.status}`); entryPrice = 0
        } else if (pnlPct <= -STOP_LOSS_PCT) {
          log('🔴 SL', `Closing at ${pnlPct.toFixed(2)}%`)
          const result = await gateway.placeOrder({
            id: `sl-${Date.now()}`, strategyId: 'mini', symbol: SYMBOL,
            side: activePos.direction === 'long' ? 'sell' : 'buy',
            type: 'MARKET', quantity: activePos.quantity,
            reduceOnly: true, timeInForce: 'IOC', timestamp: Date.now(),
          })
          log('🔴 SL', `Done: ${result.status}`); entryPrice = 0
        }
      } else {
        // ── No position — check signal ──

        if (price > sma20) {
          const qty = Math.floor((POSITION_SIZE_USDT / price) * 10) / 10
          if (qty >= 0.1) {
            log('🟢 BUY', `${qty} ${SYMBOL} @ ${price.toFixed(4)}`)
            const result = await gateway.placeOrder({
              id: `buy-${Date.now()}`, strategyId: 'mini', symbol: SYMBOL,
              side: 'buy', type: 'MARKET', quantity: qty,
              timeInForce: 'IOC', timestamp: Date.now(),
            })
            log('🟢 BUY', `Order: ${result.status} | id=${result.orderId ?? '?'}`)
            entryPrice = price
          } else {
            log('⚠️', `Qty ${qty} too small (min 0.1)`)
          }
        } else {
          log('ℹ️', `Price ${price.toFixed(4)} < SMA ${sma20.toFixed(4)} — hold`)
        }
      }

      await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS))
    } catch (err) {
      log('❌', `Tick error: ${(err as Error).message}`)
      await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS))
    }
  }
}

main().catch(err => { console.error(`\n❌ Fatal: ${err}`); process.exit(1) })
