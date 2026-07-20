#!/usr/bin/env node
/**
 * certify.ts — CLI entry point for Certification Suite (Paper Trading)
 *
 * Architecture:
 *   BybitFeedAdapter (public WS) → LiveFeedRuntime → PaperBrokerAdapter
 *                                                       ↓
 *                                            PaperExecutionGateway
 *                                                       ↓
 *                                              RiskRuntime (10 rules)
 *                                                       ↓
 *                                              GatewayRuntime
 *                                                       ↓
 *                                            CertificationRuntime (75 scenarios)
 *
 * No API keys required — real market data from Bybit public WebSocket,
 * virtual order execution via PaperProvider, full risk pipeline active.
 *
 * Usage:
 *   npx tsx scripts/certify.ts [--symbols BTCUSDT,ETHUSDT] [--balance 10000]
 *
 * Environment:
 *   SYMBOLS      — comma-separated symbols to trade (default: BTCUSDT,ETHUSDT,SOLUSDT)
 *   PAPER_BALANCE — initial balance in USDT (default: 10000)
 */

import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'
import { PaperBrokerAdapter } from '../src/workspace/live/brokers/PaperBrokerAdapter'
import { CertificationRuntime } from '../src/workspace/certification/CertificationRuntime'
import { GatewayRuntime } from '../src/workspace/live/gateway/GatewayRuntime'
import { gatewayRegistry } from '../src/workspace/live/gateway/GatewayRegistry'
import { ExecutionMode } from '../src/workspace/live/gateway/ExecutionMode'
import { PaperExecutionGateway } from '../src/workspace/live/gateway/PaperExecutionGateway'
import { RiskRuntime } from '../src/workspace/risk/runtime/RiskRuntime'
import { BUILTIN_RISK_RULES } from '../src/workspace/risk/builtins'

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      opts[key] = args[i + 1]?.startsWith('--') ? 'true' : (args[i + 1] ?? 'true')
      if (!args[i + 1]?.startsWith('--')) i++
    }
  }
  return opts
}

async function main() {
  const opts = parseArgs()
  const symbols = (opts.symbols ?? process.env.SYMBOLS ?? 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(s => s.trim()).filter(Boolean)
  const initialBalance = parseFloat(opts.balance ?? process.env.PAPER_BALANCE ?? '10000')

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   Certification Suite — Paper Trading              ║')
  console.log('║   Real prices (Bybit) + Virtual orders (Paper)     ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log()
  console.log(`Symbols:        ${symbols.join(', ')}`)
  console.log(`Initial balance: ${initialBalance} USDT`)
  console.log()

  // ── 1. LiveFeedRuntime + BybitFeedAdapter ──
  console.log('[1/4] Starting LiveFeedRuntime with BybitFeedAdapter...')
  const feedRuntime = new LiveFeedRuntime()
  const bybitAdapter = new BybitFeedAdapter()

  feedRuntime.useAdapter(bybitAdapter)

  for (const symbol of symbols) {
    await feedRuntime.subscribe(symbol)
    console.log(`      Subscribed to ${symbol}`)
  }

  // ── 2. PaperBrokerAdapter ──
  console.log('[2/4] Creating PaperBrokerAdapter...')
  const broker = new PaperBrokerAdapter(feedRuntime, {
    symbols,
    initialBalance,
    commissionRate: 0.001,
    slippageValue: 0,
  })

  // ── 3. GatewayRuntime + RiskRuntime Chain ──
  console.log('[3/4] Building GatewayRuntime → RiskRuntime → PaperExecutionGateway...')

  // 3a. Create PaperExecutionGateway that wraps PaperBrokerAdapter
  const paperGateway = new PaperExecutionGateway(broker)

  // 3b. Register paper gateway mode
  gatewayRegistry.register({
    mode: ExecutionMode.Paper,
    create: () => paperGateway,
  })

  // 3c. Create RiskRuntime with paper gateway as data source
  const riskRuntime = new RiskRuntime(paperGateway, 'paper')

  // 3d. Register all built-in risk rules
  riskRuntime.registry.registerAll(BUILTIN_RISK_RULES)

  // 3e. Create GatewayRuntime and init with paper mode
  const gatewayRuntime = new GatewayRuntime()
  await gatewayRuntime.init(ExecutionMode.Paper)

  // 3f. Attach RiskRuntime to GatewayRuntime
  gatewayRuntime.useRiskRuntime(riskRuntime)

  console.log(`      ${BUILTIN_RISK_RULES.length} risk rules registered, all enabled`)

  // ── 4. CertificationRuntime ──
  console.log('[4/4] Initialising CertificationRuntime...')
  const runtime = new CertificationRuntime(broker, gatewayRuntime)
  runtime.registerBuiltins()

  // ── 5. Run the suite ──
  console.log()
  console.log('Running 75 certification scenarios...')
  console.log()

  // Give the WS a moment to connect
  await new Promise((r) => setTimeout(r, 2_000))

  const report = await runtime.run()

  if (!report) {
    console.error('\n❌ No report returned — CertificationSuite.run() returned undefined')
    await broker.dispose()
    process.exit(1)
  }

  console.log()
  console.log('=' .repeat(58))
  console.log(CertificationRuntime.formatReport(report))
  console.log()
  console.log(`Finished: ${new Date().toISOString()}`)

  // ── Cleanup ──
  await broker.dispose()

  const s = report
  const total = s.total
  const passRate = s.passRate

  if (s.failed > 0 || s.errors > 0) {
    console.log(`\n📊 ${s.passed}/${total} passed (${passRate}%) — ${s.failed} failed, ${s.skipped} skipped, ${s.errors} errors, ${report.failures.length > 0 ? report.failures.length + ' failure(s)' : ''}`)
    console.log(`   ❌ ${s.failed} scenario(s) FAILED`)
    process.exit(Math.min(s.failed, 127))
  }
  console.log(`\n✅ All ${s.passed} scenarios passed (${passRate}%)`)
}

main().catch((err) => {
  console.error('❌ Certification Suite fatal error:', err)
  process.exit(1)
})
