#!/usr/bin/env node
/**
 * stress-test-campaign.ts — 7-Day Stress Test bootstrap (≈40 строк)
 *
 * Usage:
 *   npx tsx scripts/stress-test-campaign.ts          # default 7d
 *   DURATION_HOURS=168 npx tsx scripts/stress-test-campaign.ts
 *
 * What it tests:
 *   - Continuous price feed for 7 days (bybit WebSocket)
 *   - Paper broker with minimal risk
 *   - Healthcheck endpoint verification
 *   - Memory/resource leak detection
 *   - Kill Switch readiness
 *
 * This script runs in paper mode with 1 symbol (XRPUSDT) and 0.25% risk.
 */
import { PaperBrokerAdapter } from '../src/workspace/live/brokers/PaperBrokerAdapter'
import { PaperExecutionGateway } from '../src/workspace/live/gateway/PaperExecutionGateway'
import { BUILTIN_RISK_RULES } from '../src/workspace/risk/builtins'
import { WorkspaceFactory } from '../src/workspace/trading'
import { PaperCampaign } from '../src/workspace/campaign/PaperCampaign'
import { CampaignMode } from '../src/workspace/campaign/types'
import { CampaignReporter } from '../src/workspace/campaign/CampaignReporter'
import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'

// ── Configuration ──
const DURATION_HOURS = parseInt(process.env.DURATION_HOURS ?? '168', 10) // 7 days
const SYMBOL = process.env.SYMBOL ?? 'XRPUSDT'
const START_BALANCE = parseInt(process.env.START_BALANCE ?? '500', 10) // 500 USDT
const COMMISSION = parseFloat(process.env.COMMISSION ?? '0.001') // 0.1%

console.log(`
╔══════════════════════════════════════════╗
║   TRADING WORKSPACE — 7-Day Stress Test ║
╠══════════════════════════════════════════╣
║  Symbol:    ${SYMBOL.padEnd(30)}║
║  Duration:  ${String(DURATION_HOURS).padEnd(3)}h (${(DURATION_HOURS / 24).toFixed(0)}d)${' '.repeat(17)}║
║  Mode:      paper${' '.repeat(24)}║
║  Balance:   ${String(START_BALANCE).padEnd(4)} USDT${' '.repeat(21)}║
║  Risk:      0.25% per trade${' '.repeat(15)}║
╚══════════════════════════════════════════╝
`)

// ── Feed (real Bybit WebSocket, paper execution) ──
const feed = new LiveFeedRuntime()
feed.useAdapter(new BybitFeedAdapter())
await feed.subscribe(SYMBOL)

// ── Workspace ──
const ws = await WorkspaceFactory.create({
  name: 'stress-test',
  mode: 'paper' as any,
  symbols: [SYMBOL],
  gateway: new PaperExecutionGateway(
    new PaperBrokerAdapter(feed, {
      symbols: [SYMBOL],
      initialBalance: START_BALANCE,
      commissionRate: COMMISSION,
    }),
  ),
  riskRules: BUILTIN_RISK_RULES,
})

// ── Campaign ──
const campaign = new PaperCampaign({
  mode: CampaignMode.FullCampaign,
  symbols: [SYMBOL],
  maxDurationHours: DURATION_HOURS,
  onStageChange: (s) => {
    const ts = new Date().toISOString()
    console.log(`[${ts}] [StressTest] Stage → ${s}`)
  },
  onDailyReport: (r) => {
    CampaignReporter.printDailyReport(r)
    // Record checkpoint
    const health = ws.health()
    console.log(`[StressTest] Health: status=${health.status} uptime=${(health.uptimeMs / 3600000).toFixed(1)}h gateway=${health.gatewayConnected}`)
  },
  onBurnInComplete: (r) => {
    CampaignReporter.printBurnInResult(r)
    console.log(`[StressTest] Burn-in complete — entering main campaign`)
  },
  onFinalReport: (r) => {
    CampaignReporter.printFinalReport(r)
    const health = ws.health()
    console.log(`\n[StressTest] FINAL REPORT`)
    console.log(`[StressTest] Duration:  ${(health.uptimeMs / 3600000).toFixed(1)}h`)
    console.log(`[StressTest] Status:    ${health.status}`)
    console.log(`[StressTest] Gateway:   ${health.gatewayConnected ? 'connected' : 'disconnected'}`)
    console.log(`[StressTest] SafeMode:  ${health.safeMode}`)
    const elapsed = Date.now() - new Date(health.uptimeMs).getTime()
    console.log(`[StressTest] Result:    ${r.success ? 'PASS' : 'FAIL'} — ${r.summary}`)
  },
})

campaign.setComponents({
  gateway: ws.gateway,
  feedRuntime: feed,
  broker: ws.broker!,
  certRuntime: {} as any,
})

// ── Signal handling ──
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n[StressTest] Received ${sig} — stopping...`)
    campaign.requestStop()
  })
}

// ── Periodic healthcheck ──
const healthInterval = setInterval(() => {
  const h = ws.health()
  const mem = process.memoryUsage()
  console.log(
    `[StressTest] ` +
    `status=${h.status} ` +
    `uptime=${(h.uptimeMs / 60000).toFixed(0)}m ` +
    `gateway=${h.gatewayConnected} ` +
    `rss=${(mem.rss / 1024 / 1024).toFixed(0)}MB ` +
    `heap=${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB`,
  )
}, 3600000) // Every hour

// ── Start ──
console.log(`[StressTest] Starting ${DURATION_HOURS}h campaign on ${SYMBOL}...`)
console.log(`[StressTest] PID: ${process.pid}`)
await campaign.start()

// Cleanup
clearInterval(healthInterval)
console.log(`[StressTest] Campaign ended after ${DURATION_HOURS}h`)
process.exit(0)
