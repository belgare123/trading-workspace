#!/usr/bin/env node
/**
 * bybit-testnet-campaign.ts — Bybit TestNet Campaign
 *
 * Runs a PaperCampaign on Bybit TestNet with real API keys.
 * Uses BybitBrokerAdapter for order execution on TestNet.
 *
 * This is a clone of paper-campaign.ts but wired to Bybit TestNet
 * instead of the paper simulator.
 *
 * Usage:
 *   npx tsx scripts/bybit-testnet-campaign.ts [--symbols BTCUSDT,ETHUSDT] [--mode burn-in|full]
 *
 * Environment:
 *   BYBIT_TESTNET_API_KEY       — Required: Bybit TestNet API key
 *   BYBIT_TESTNET_API_SECRET    — Required: Bybit TestNet API secret
 *   BYBIT_TESTNET_SYMBOLS       — Comma-separated symbols (default: BTCUSDT,ETHUSDT,SOLUSDT)
 *   BYBIT_TESTNET_MODE          — 'burn-in' or 'full' (default: full)
 *   BYBIT_TESTNET_STATE_DIR     — State directory (default: .bybit-testnet-state/)
 *
 * @since 4.9E
 */

import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'
import { BybitBrokerAdapter } from '../src/workspace/live/brokers/BybitBrokerAdapter'
import { BybitExecutionGateway } from '../src/workspace/live/gateway/BybitExecutionGateway'
import { CertificationRuntime } from '../src/workspace/certification/CertificationRuntime'
import { GatewayRuntime } from '../src/workspace/live/gateway/GatewayRuntime'
import { gatewayRegistry } from '../src/workspace/live/gateway/GatewayRegistry'
import { ExecutionMode } from '../src/workspace/live/gateway/ExecutionMode'
import { RiskRuntime } from '../src/workspace/risk/runtime/RiskRuntime'
import { BUILTIN_RISK_RULES } from '../src/workspace/risk/builtins'
import { PaperCampaign } from '../src/workspace/campaign/PaperCampaign'
import { CampaignMode, CampaignStage } from '../src/workspace/campaign/types'
import { CampaignReporter } from '../src/workspace/campaign/CampaignReporter'
import * as fs from 'fs'
import * as path from 'path'

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

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    console.error(`❌ Required environment variable ${name} is not set.`)
    console.error(`   Set it in your shell or .env file:`)
    console.error(`   export ${name}=your_value`)
    process.exit(1)
  }
  return val
}

async function main() {
  const opts = parseArgs()

  // ── Config from env ──
  const apiKey = requireEnv('BYBIT_TESTNET_API_KEY')
  const apiSecret = requireEnv('BYBIT_TESTNET_API_SECRET')
  const mode = (opts.mode ?? process.env.BYBIT_TESTNET_MODE ?? 'full') as 'burn-in' | 'full'
  const symbols = (opts.symbols ?? process.env.BYBIT_TESTNET_SYMBOLS ?? 'BTCUSDT,ETHUSDT,SOLUSDT')
    .split(',').map(s => s.trim()).filter(Boolean)
  const stateDir = opts['state-dir'] ?? process.env.BYBIT_TESTNET_STATE_DIR ?? '.bybit-testnet-state'

  // Ensure state directory exists
  const statePath = path.resolve(stateDir)
  if (!fs.existsSync(statePath)) {
    fs.mkdirSync(statePath, { recursive: true })
  }

  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   Bybit TestNet Campaign — Live TestNet Trading    ║')
  console.log('║   Sprint 4.9E — BybitBrokerAdapter v1              ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log()
  console.log(`Mode:           ${mode === 'burn-in' ? 'Burn-in only' : 'Burn-in → TestNet Campaign'}`)
  console.log(`Symbols:        ${symbols.join(', ')}`)
  console.log(`TestNet API:    ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)
  console.log(`State dir:      ${statePath}`)
  console.log()

  // ── 1. LiveFeedRuntime + BybitFeedAdapter (public market data) ──
  console.log('[1/5] Starting LiveFeedRuntime with BybitFeedAdapter...')
  const feedRuntime = new LiveFeedRuntime()
  const bybitFeed = new BybitFeedAdapter()

  feedRuntime.useAdapter(bybitFeed)

  for (const symbol of symbols) {
    await feedRuntime.subscribe(symbol)
    console.log(`      Subscribed to ${symbol}`)
  }

  // ── 2. BybitBrokerAdapter (TestNet execution) ──
  console.log('[2/5] Creating BybitBrokerAdapter (TestNet)...')
  const broker = new BybitBrokerAdapter()

  // ── 3. GatewayRuntime + RiskRuntime Chain ──
  console.log('[3/5] Building GatewayRuntime → BybitExecutionGateway → RiskRuntime...')

  const testnetGateway = new BybitExecutionGateway(broker)
  gatewayRegistry.register({
    mode: ExecutionMode.Live,
    create: () => testnetGateway,
  })

  const riskRuntime = new RiskRuntime(testnetGateway, 'bybit-testnet')
  riskRuntime.registry.registerAll(BUILTIN_RISK_RULES)

  const gatewayRuntime = new GatewayRuntime()
  await gatewayRuntime.init(ExecutionMode.Live, {
    credentials: { apiKey, apiSecret },
  })
  gatewayRuntime.useRiskRuntime(riskRuntime)

  console.log(`      ${BUILTIN_RISK_RULES.length} risk rules registered`)
  console.log(`      Gateway using mode: ${ExecutionMode.Live}`)

  // ── 4. CertificationRuntime ──
  console.log('[4/5] Initialising CertificationRuntime...')
  const certRuntime = new CertificationRuntime(broker, gatewayRuntime)
  certRuntime.registerBuiltins()

  // ── 5. PaperCampaign (reused orchestrator) ──
  console.log('[5/5] Starting PaperCampaign with Bybit TestNet adapter...')
  console.log()

  // Give WS a moment to connect
  await new Promise((r) => setTimeout(r, 3_000))

  const campaign = new PaperCampaign({
    mode: mode === 'burn-in' ? CampaignMode.BurnIn : CampaignMode.FullCampaign,
    symbols,
    stateDir: path.join(statePath, 'paper-campaign'),
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
  console.error('\n❌ Bybit TestNet Campaign fatal error:', err)
  process.exit(1)
})
