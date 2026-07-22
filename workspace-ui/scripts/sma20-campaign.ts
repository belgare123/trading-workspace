#!/usr/bin/env npx tsx
/**
 * sma20-campaign.ts — SMA20 strategy demo bootstrap
 * Sprint 5.7 — New pipeline: MarketFeed → StrategyRuntime → StrategyExecutor → TradeLifecycleRuntime
 *
 * Usage:
 *   export BYBIT_API_KEY=...
 *   export BYBIT_API_SECRET=...
 *   npx tsx scripts/sma20-campaign.ts
 *
 * This script is a THIN BOOTSTRAP (≈25 строк) — no trading logic here.
 * All trade decisions come from SMA20 strategy.
 * All execution goes through TradeLifecycleRuntime → WalletManager → OrderManager.
 */
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'
import { BybitBrokerAdapter } from '../src/workspace/live/brokers/BybitBrokerAdapter'
import { BybitExecutionGateway } from '../src/workspace/live/gateway/BybitExecutionGateway'
import { BUILTIN_RISK_RULES } from '../src/workspace/risk/builtins'
import { WorkspaceBuilder } from '../src/workspace/trading'
import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { SingletonGuard } from './demo/singleton-guard'
import { SmaCross } from '../src/workspace/strategy/definitions/SmaCross'

const apiKey = process.env.BYBIT_API_KEY!
const apiSecret = process.env.BYBIT_API_SECRET!
if (!apiKey || !apiSecret) { console.error('❌ BYBIT_API_KEY & BYBIT_API_SECRET required'); process.exit(1) }
const symbols = (process.env.SYMBOLS ?? 'BTCUSDT,ETHUSDT').split(',').map(s => s.trim())

const guard = new SingletonGuard({ name: 'sma20-campaign' })
if (!guard.acquire()) { console.error('❌ Already running'); process.exit(0) }
process.on('exit', () => guard.release())

const feed = new LiveFeedRuntime()
feed.useAdapter(new BybitFeedAdapter())
for (const s of symbols) await feed.subscribe(s)

const ws = await WorkspaceBuilder.create()
  .withName('sma20-demo')
  .withMode('paper')
  .withGateway(new BybitExecutionGateway(new BybitBrokerAdapter(), false))
  .withSymbols(symbols)
  .withRiskRules(BUILTIN_RISK_RULES)
  .withStrategy(new SmaCross(), { fastPeriod: 10, slowPeriod: 30 })
  .build()

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => ws.shutdown())
await ws.start()
