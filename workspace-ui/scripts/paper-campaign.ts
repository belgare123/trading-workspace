#!/usr/bin/env node
/**
 * paper-campaign.ts — Phase 2 Paper Campaign (Operational Validation)
 *
 * Flow:
 *   Bybit WebSocket → LiveFeedRuntime → StrategyRuntime.tick()
 *     → signal event → PaperBrokerAdapter.placeOrder()
 *     → PaperProvider → TradeJournal / CashLedger
 *
 * Architecture:
 *   - We create the LiveFeedRuntime with BybitFeedAdapter EXTERNALLY
 *   - Pass broker + gateway to WorkspaceBuilder (which creates its own feed)
 *   - The campaign uses ws.feed (no adapter, just for lifecycle)
 *   - Our external feed sends data; broker/gateway share it via PaperBrokerAdapter
 *   - Bypasses broken orderManager.on() via direct PaperBrokerAdapter.placeOrder()
 *
 * @since Phase 2 — RC1
 */

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'
import { PaperBrokerAdapter } from '../src/workspace/live/brokers/PaperBrokerAdapter'
import { PaperExecutionGateway } from '../src/workspace/live/gateway/PaperExecutionGateway'
import { WorkspaceBuilder } from '../src/workspace/trading/WorkspaceBuilder'
import { StrategyRegistry } from '../src/workspace/strategy/registry/StrategyRegistry'
import { SmaCross } from '../src/workspace/strategy/definitions/SmaCross'
import type { StrategySignal, StrategyInstanceData } from '../src/workspace/strategy/types'
import type { StrategyBar } from '../src/workspace/strategy/definition'
import type { MarketEvent } from '../src/workspace/live/feed/MarketEventBus'
import { PaperCampaign, type PaperCampaignConfig } from '../src/workspace/campaign/PaperCampaign'
import { CampaignMode } from '../src/workspace/campaign/types'
import { createCampaignContext } from '../src/workspace/campaign/CampaignContext'
import { CampaignMetricsProvider } from '../src/workspace/campaign/CampaignMetricsProvider'
import { CampaignSnapshotWriter } from '../src/workspace/campaign/CampaignSnapshotWriter'
import { CampaignMetricsCollector } from '../src/workspace/campaign/CampaignMetricsCollector'
import { CertificationRuntime } from '../src/workspace/certification/CertificationRuntime'
import type { BrokerOrder } from '../src/workspace/live/brokers/BrokerAdapter'
import * as path from 'path'
import { writeFileSync, unlinkSync } from 'fs'

// ════════════════════════════════════════
// Configuration
// ════════════════════════════════════════

const SYMBOLS = ['BTCUSDT' as const]
const SYMBOL = SYMBOLS[0]
const TIMEFRAME = '15m'
const INITIAL_BALANCE = 10_000
const FAST_PERIOD = 5
const SLOW_PERIOD = 15

const CAMPAIGN_MODE = process.env.CAMPAIGN_MODE as CampaignMode | undefined
const SMOKE_MODE = process.env.SMOKE_MODE === 'true'

console.log('╔══════════════════════════════════════════════════════╗')
console.log('║   Paper Campaign — Phase 2 Operational Validation   ║')
console.log('╚══════════════════════════════════════════════════════╝')
console.log()
console.log(`Symbol:      ${SYMBOL}`)
console.log(`Timeframe:   ${TIMEFRAME}`)
console.log(`SmaCross:    ${FAST_PERIOD}/${SLOW_PERIOD}`)
console.log(`Initial:     ${INITIAL_BALANCE} USDT`)
console.log(`Mode:        ${SMOKE_MODE ? 'SMOKE (2h)' : CAMPAIGN_MODE ?? 'FULL'} `)
console.log()

// ════════════════════════════════════════
// 1. Create Feed + Adapter (External)
// ════════════════════════════════════════

const feed = new LiveFeedRuntime()
const bybitAdapter = new BybitFeedAdapter(undefined, undefined, '15')
await feed.useAdapter(bybitAdapter)
console.log('[feed] BybitFeedAdapter connected')

// ════════════════════════════════════════
// 2. Create Broker + Gateway
// ════════════════════════════════════════

const broker = new PaperBrokerAdapter(feed, {
  initialBalance: INITIAL_BALANCE,
  commissionRate: 0.001,
  slippageValue: 0,
  symbols: [...SYMBOLS],
  seedBaseAssets: true,  // seed BTC for sell orders
})
const gateway = new PaperExecutionGateway(broker)
console.log('[broker] PaperBrokerAdapter ready')
console.log('[gw]     PaperExecutionGateway ready')

// ════════════════════════════════════════
// 3. Build Workspace
// ════════════════════════════════════════

const ws = await new WorkspaceBuilder()
  .withConfig({
    symbols: [...SYMBOLS],
    mode: 'paper' as any,
    name: 'paper-campaign',
  })
  .withGateway(gateway)
  .withBroker(broker)
  // NOTE: No .withFeed() — BybitFeedAdapter is registered on our external feed
  // No .withStrategy() — we register SmaCross manually after build
  .build()

console.log('[ws] Workspace built')

// ════════════════════════════════════════
// 4. Subscribe to Market Data (on OUR feed)
// ════════════════════════════════════════

for (const s of SYMBOLS) {
  await feed.subscribe(s)
}
console.log(`[feed] Subscribed to ${SYMBOLS.join(', ')}`)

// ════════════════════════════════════════
// 5. Connect Gateway + Start Workspace
// ════════════════════════════════════════

// ws.start() calls gatewayRuntime.use(executionGateway)
// → PaperExecutionGateway.connect() → PaperConnectionAdapter.connect()
//   → feedRuntime.start() (idempotent — our external feed)
//   → feedRuntime.subscribe(symbol) (idempotent — already subscribed)
//   → paper.connect({...}) (seeds PaperProvider, subscribes broker to feed bus)
const recovery = await ws.start()
console.log(`[ws] Started (recovery: ${recovery?.recovered ?? 0} trades)`)

// ════════════════════════════════════════
// 6. Register SmaCross Strategy
// ════════════════════════════════════════

const smaCross = new SmaCross()
StrategyRegistry.register(smaCross)

const strategyId = ws.strategy.add(
  smaCross.id,
  smaCross.name,
  SYMBOL,
  TIMEFRAME,
  { fastPeriod: FAST_PERIOD, slowPeriod: SLOW_PERIOD },
)
ws.strategy.start(strategyId)
console.log(`[strategy] SmaCross registered: ${smaCross.name} on ${SYMBOL} @ ${TIMEFRAME} (${FAST_PERIOD}/${SLOW_PERIOD})`)
console.log(`[strategy] Instance ID: ${strategyId}`)

// ════════════════════════════════════════
// 7. Bridge: Market Data → Strategy
// ════════════════════════════════════════

let klineCount = 0
let barCount = 0
let signalCount = 0
let orderCount = 0
let lastSignal: StrategySignal | null = null
const lastPrice: Record<string, number> = {}

feed.bus.on('market:kline', (event: MarketEvent) => {
  if (event.type !== 'market:kline') return
  if (event.data.symbol !== SYMBOL) return

  klineCount++

  lastPrice[event.data.symbol] = event.data.close

  const bar: StrategyBar = {
    open: event.data.open,
    high: event.data.high,
    low: event.data.low,
    close: event.data.close,
    volume: event.data.volume,
    timestamp: event.data.timestamp,
  }

  barCount++
  const signal = ws.strategy.tick(strategyId, bar)
  if (signal !== null) {
    signalCount++
    lastSignal = signal
    console.log(`[strategy] 🎯 Signal #${signalCount}: ${signal.direction.toUpperCase()} price=${bar.close.toFixed(2)} ts=${new Date(event.data.timestamp).toISOString()}`)
  }
})

console.log('[bridge] market:kline → StrategyRuntime.tick() connected')

// ════════════════════════════════════════
// 8. Bridge: Strategy Signal → Paper Broker
// ════════════════════════════════════════

// We use ws.strategy.on('signal') which fires AFTER tick() emits the event
ws.strategy.on('signal', ((signal: StrategySignal, inst: StrategyInstanceData) => {
  if (signal.direction === 'buy') {
    console.log(`[bridge] 📈 BUY signal: ${inst.symbol} price=${signal.price}`)
    placeBuyOrder(inst.symbol, signal).catch(err => {
      console.error(`[bridge] ❌ BUY failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  } else if (signal.direction === 'sell' || signal.direction === 'close') {
    console.log(`[bridge] 📉 CLOSE signal: ${inst.symbol}`)
    placeCloseOrder(inst.symbol).catch(err => {
      console.error(`[bridge] ❌ CLOSE failed: ${err instanceof Error ? err.message : String(err)}`)
    })
  }
}) as any)

console.log('[bridge] StrategyRuntime signal → PaperBroker ready')

// ════════════════════════════════════════
// 9. Order Execution
// ════════════════════════════════════════

async function getCurrentPrice(symbol: string): Promise<number> {
  if (lastPrice[symbol] !== undefined && lastPrice[symbol] > 0) {
    return lastPrice[symbol]
  }
  throw new Error(`Cannot determine current price for ${symbol} — no signal.price and no kline data received yet`)
}

async function placeBuyOrder(symbol: string, signal: StrategySignal): Promise<void> {
  const price = signal.price ?? (await getCurrentPrice(symbol))
  if (price <= 0) {
    console.error(`[bridge] Cannot place BUY — invalid price: ${price}`)
    return
  }

  const quantity = Math.max(0.001, (INITIAL_BALANCE * 0.5) / price)

  const result = await broker.orders.placeOrder({
    symbol,
    side: 'buy',
    type: 'market',
    quantity,
    price,
    timeInForce: 'gtc',
    strategyId: strategyId,
    clientOrderId: `buy_${Date.now()}`,
  } as any)

  if (result.brokerOrderId) {
    orderCount++
    console.log(`[bridge] ✅ BUY filled: ${result.filledQuantity} @ ${result.averagePrice?.toFixed(2) ?? 'market'} order=${result.brokerOrderId}`)
  }
}

async function placeCloseOrder(symbol: string): Promise<void> {
  // Look up current position from broker
  let positionQty = 0
  let currentPosition: any = null
  try {
    const positions = await broker.positions.getPositions()
    currentPosition = positions.find((p: any) => p.symbol === symbol)
    if (currentPosition) positionQty = Math.abs(currentPosition.quantity ?? 0)
  } catch (err) {
    throw new Error(`Cannot close ${symbol}: failed to fetch position — ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!currentPosition || positionQty <= 0) {
    throw new Error(`Cannot close ${symbol}: no open position found (already flat)`)
  }

  // Invariant: close quantity must match open position quantity
  if (Math.abs(positionQty - currentPosition.quantity) > 1e-12) {
    console.warn(
      `[bridge] ⚠️ Close quantity mismatch: computed=${positionQty.toFixed(8)} position=${currentPosition.quantity.toFixed(8)}`
    )
  }

  const result = await broker.orders.placeOrder({
    symbol,
    side: 'sell',
    type: 'market',
    quantity: positionQty,
    price: 0,
    timeInForce: 'gtc',
    strategyId: strategyId,
    clientOrderId: `close_${Date.now()}`,
  } as any)

  if (result.brokerOrderId) {
    orderCount++
    console.log(`[bridge] ✅ CLOSE filled: ${result.filledQuantity} @ ${result.averagePrice?.toFixed(2) ?? 'market'} order=${result.brokerOrderId}`)
  }
}

// ════════════════════════════════════════
// 10. PaperCampaign Orchestrator
// ════════════════════════════════════════

const campaignConfig: PaperCampaignConfig = {
  symbols: [...SYMBOLS],
  mode: CAMPAIGN_MODE ?? (SMOKE_MODE ? CampaignMode.BurnIn : CampaignMode.FullCampaign),
  // Smoke mode: very short burn-in (10 min default for PaperCampaign is 24h, override here)
  ...(SMOKE_MODE ? {
    burnInDurationMs: 2 * 60 * 60 * 1000,   // 2 hours
    campaignDurationMs: 2 * 60 * 60 * 1000,  // 2 hours total (skip full campaign)
  } : {}),
  // Callbacks
  onStageChange: (stage) => {
    console.log(`[campaign] Stage → ${stage}`)
  },
  onIncident: (incident) => {
    console.log(`[campaign] ⚠️ Incident: [${incident.severity}] ${incident.message}`)
  },
}

const campaign = new PaperCampaign(campaignConfig)
campaign.setComponents({
  gateway: ws.gateway,
  feedRuntime: ws.feed,
  broker,
  certRuntime: new CertificationRuntime(),
})

// ════════════════════════════════════════
// 10b. Campaign Metrics Collector
// ════════════════════════════════════════

const campaignContext = createCampaignContext({
  exchange: 'bybit',
  strategy: 'SmaCross',
  mode: SMOKE_MODE ? 'smoke' : CAMPAIGN_MODE === 'BurnIn' ? 'burn-in' : 'campaign',
})

const metricsProvider = new CampaignMetricsProvider({
  execution: (broker.paper as any),
  health: () => campaign.supervisor.getHealth(),
})

const metricsWriter = new CampaignSnapshotWriter({
  stateDir: path.join(campaign.campaignStateDir, 'metrics'),
})

const metricsCollector = new CampaignMetricsCollector(
  campaignContext,
  metricsProvider,
  metricsWriter,
  { intervalMs: 60_000, tickOnStart: true },
)

// ════════════════════════════════════════
// 11. TradeJournal Monitor
// ════════════════════════════════════════

function logTradeStats(): void {
  try {
    const tradeLedger = (broker.paper as any).tradeLedger
    const trades = tradeLedger?.all() ?? []
    let totalPnl = 0
    let totalFees = 0
    for (const t of trades) {
      if (typeof t.realizedPnl === 'number') totalPnl += t.realizedPnl
      if (typeof t.commission === 'number') totalFees += t.commission
    }

    const cashLedger = (broker.paper as any).cashLedger
    const balance = cashLedger?.free?.('USDT') ?? 0

    const equityLedger = (broker.paper as any).equityLedger
    const latest = equityLedger?.latest?.()
    const equity = latest?.totalEquity ?? 0

    const journal = (broker.paper as any).journal
    const entries = journal?.getAll() ?? []

    console.log()
    console.log('┌─── Trade Stats ────────────────────────────────┐')
    console.log(`│ USDT free:       ${String(balance.toFixed(2)).padStart(12)}  │`)
    console.log(`│ Equity:          ${String(equity.toFixed(2)).padStart(12)}  │`)
    console.log(`│ Realised PnL:    ${String(totalPnl.toFixed(2)).padStart(12)}  │`)
    console.log(`│ Total Fees:      ${String(totalFees.toFixed(2)).padStart(12)}  │`)
    console.log(`│ Journal entries: ${String(entries.length).padStart(8)}  │`)
    console.log(`│ Trades recorded: ${String(trades.length).padStart(8)}  │`)
    console.log(`│ Klines recv:     ${String(klineCount).padStart(8)}  │`)
    console.log(`│ Bars processed:  ${String(barCount).padStart(8)}  │`)
    console.log(`│ Signals:         ${String(signalCount).padStart(8)}  │`)
    console.log(`│ Orders executed: ${String(orderCount).padStart(8)}  │`)
    console.log('└────────────────────────────────────────────────┘')
    console.log()
  } catch (err) {
    console.error('[stats] TradeJournal stats error:', err)
  }
}

// Log stats every 5 minutes in the background
const statsInterval = setInterval(logTradeStats, 5 * 60 * 1000)

// ════════════════════════════════════════
// 12. Start Campaign
// ════════════════════════════════════════

console.log()
console.log('════════════════════════════════════════════════════════')
console.log('   Starting Campaign...')
console.log('════════════════════════════════════════════════════════')
console.log()

// Wait for enough klines before signal (slow period = 15 min)
console.log(`[init] Awaiting first signal — slow period ${SLOW_PERIOD} bars ≈ ${SLOW_PERIOD} min`)
console.log(`[init] Use SMOKE_MODE=true for 2h test, or CAMPAIGN_MODE=FullCampaign for 7d`)
console.log()

let pidPath: string | null = null

function writePidFile(stateDir: string): void {
  pidPath = path.join(stateDir, 'campaign.pid')
  writeFileSync(pidPath, String(process.pid), 'utf8')
  console.log(`[campaign] PID ${process.pid} → ${pidPath}`)
}

function cleanupPidFile(): void {
  if (pidPath) {
    try { unlinkSync(pidPath) } catch { /* ok */ }
    pidPath = null
  }
}

// Handle graceful shutdown
let shuttingDown = false
const doShutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  campaign.requestStop()
  metricsCollector.stop()
  clearInterval(statsInterval)
  cleanupPidFile()
}
process.on('SIGINT', () => {
  console.log('\n[shutdown] Received SIGINT — stopping campaign...')
  doShutdown()
})
process.on('SIGTERM', () => {
  console.log('\n[shutdown] Received SIGTERM — stopping campaign...')
  doShutdown()
})

// Start metrics collection alongside the campaign
metricsCollector.start()
console.log(`[metrics] Collector started → ${metricsWriter.directory}`)

// Write PID file for health check
writePidFile(campaign.campaignStateDir)

try {
  await campaign.start()
} catch (err) {
  console.error('[campaign] Fatal error:', err)
  cleanupPidFile()
  process.exit(1)
} finally {
  // Ensure collector is stopped when campaign ends
  if (metricsCollector.isRunning) {
    metricsCollector.stop()
  }
  clearInterval(statsInterval)
  cleanupPidFile()
}
