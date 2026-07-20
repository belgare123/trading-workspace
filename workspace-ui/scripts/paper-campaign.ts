#!/usr/bin/env node
/**
 * paper-campaign.ts — CLI entry point for Paper Campaign (Burn-in + 7d)
 *
 * Runs the Paper Campaign as a background daemon.
 * Stage 1: 24-hour burn-in → Stage 2: 7-day campaign.
 *
 * Usage:
 *   npx tsx scripts/paper-campaign.ts [--mode burn-in|full] [--symbols BTCUSDT,ETHUSDT,SOLUSDT] [--balance 10000]
 *
 * Environment:
 *   MODE         — 'burn-in' or 'full' (default: full)
 *   SYMBOLS      — comma-separated symbols
 *   PAPER_BALANCE — initial balance
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
import { PaperCampaign } from '../src/workspace/campaign/PaperCampaign'
import { CampaignMode, CampaignStage } from '../src/workspace/campaign/types'
import { CampaignReporter } from '../src/workspace/campaign/CampaignReporter'

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
  const mode = (opts.mode ?? process.env.MODE ?? 'full') as 'burn-in' | 'full'
  const symbols = (opts.symbols ?? process.env.SYMBOLS ?? 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(s => s.trim()).filter(Boolean)
  const initialBalance = parseFloat(opts.balance ?? process.env.PAPER_BALANCE ?? '10000')

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   Paper Campaign — Two-Stage Campaign              ║')
  console.log('║   Burn-in (24h) → Paper Trading (7d)              ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log()
  console.log(`Mode:           ${mode === 'burn-in' ? 'Burn-in only' : 'Burn-in → Paper Campaign (7d)'}`)
  console.log(`Symbols:        ${symbols.join(', ')}`)
  console.log(`Initial balance: ${initialBalance} USDT`)
  console.log()

  // ── 1. LiveFeedRuntime + BybitFeedAdapter ──
  console.log('[1/5] Starting LiveFeedRuntime with BybitFeedAdapter...')
  const feedRuntime = new LiveFeedRuntime()
  const bybitAdapter = new BybitFeedAdapter()

  feedRuntime.useAdapter(bybitAdapter)

  for (const symbol of symbols) {
    await feedRuntime.subscribe(symbol)
    console.log(`      Subscribed to ${symbol}`)
  }

  // ── 2. PaperBrokerAdapter ──
  console.log('[2/5] Creating PaperBrokerAdapter...')
  const broker = new PaperBrokerAdapter(feedRuntime, {
    symbols,
    initialBalance,
    commissionRate: 0.001,
    slippageValue: 0,
  })

  // ── 3. GatewayRuntime + RiskRuntime Chain ──
  console.log('[3/5] Building GatewayRuntime → RiskRuntime → PaperExecutionGateway...')

  const paperGateway = new PaperExecutionGateway(broker)
  gatewayRegistry.register({
    mode: ExecutionMode.Paper,
    create: () => paperGateway,
  })

  const riskRuntime = new RiskRuntime(paperGateway, 'paper')
  riskRuntime.registry.registerAll(BUILTIN_RISK_RULES)

  const gatewayRuntime = new GatewayRuntime()
  await gatewayRuntime.init(ExecutionMode.Paper)
  gatewayRuntime.useRiskRuntime(riskRuntime)

  console.log(`      ${BUILTIN_RISK_RULES.length} risk rules registered`)

  // ── 4. CertificationRuntime ──
  console.log('[4/5] Initialising CertificationRuntime...')
  const certRuntime = new CertificationRuntime(broker, gatewayRuntime)
  certRuntime.registerBuiltins()

  // ── 5. PaperCampaign ──
  console.log('[5/5] Starting PaperCampaign...')
  console.log()

  // Give WS a moment to connect
  await new Promise((r) => setTimeout(r, 2_000))

  const campaign = new PaperCampaign({
    mode: mode === 'burn-in' ? CampaignMode.BurnIn : CampaignMode.FullCampaign,
    symbols,
    onStageChange: (stage) => {
      console.log(`\n[Campaign] Stage → ${stage}`)
    },
    onIncident: (incident) => {
      console.log(`\n[Incident] ${incident.severity}: ${incident.message}`)
    },
    onDailyReport: (report) => {
      CampaignReporter.printDailyReport(report)
    },
    onBurnInComplete: (result) => {
      CampaignReporter.printBurnInResult(result)
    },
    onFinalReport: (report) => {
      CampaignReporter.printFinalReport(report)
    },
  })

  campaign.setComponents({
    gateway: gatewayRuntime,
    feedRuntime,
    broker,
    certRuntime,
  })

  // Wire supervisor to gateway state
  campaign.supervisor.recordGatewayState(true)

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n[Shutdown] Received signal, stopping campaign...')
    campaign.requestStop()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGHUP', shutdown)

  await campaign.start()
}

main().catch((err) => {
  console.error('\n❌ Paper Campaign fatal error:', err)
  process.exit(1)
})
