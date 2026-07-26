#!/usr/bin/env node
/**
 * cron-report.js — Generates a campaign report snapshot, writes to
 * reports/ dir, and outputs a compact summary for cron delivery.
 *
 * Usage: node scripts/cron-report.js <campaign-id>
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const reportsDir = path.join(repoRoot, 'reports')

const campaignId = process.argv[2] || ''

// Determine the latest campaign ID if not specified
async function getLatestCampaign() {
  const { ReportEngine } = await import('../src/workspace/campaign/reports/ReportEngine.js')
  const os = await import('os')
  const engine = new ReportEngine({ dir: path.join(os.tmpdir(), 'paper-campaign', 'metrics') })
  const campaigns = engine.discoverCampaigns()
  // Pick the one with most recent endTime
  campaigns.sort((a, b) => b.endTime - a.endTime)
  return campaigns[0]
}

async function main() {
  const { ReportEngine } = await import('../src/workspace/campaign/reports/ReportEngine.js')
  const { MarkdownRenderer } = await import('../src/workspace/campaign/reports/MarkdownRenderer.js')
  const os = await import('os')

  const engine = new ReportEngine({ dir: path.join(os.tmpdir(), 'paper-campaign', 'metrics') })

  let targetId = campaignId
  if (!targetId) {
    const latest = await getLatestCampaign()
    targetId = latest?.id
    if (!targetId) {
      console.log('⚠️ No campaign data found')
      process.exit(0)
    }
  }

  // Generate report
  const data = engine.generate({ campaignId: targetId })
  const renderer = new MarkdownRenderer()
  const report = renderer.render(data)

  // Save with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `campaign-${targetId}-${timestamp}.md`
  const filepath = path.join(reportsDir, filename)
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })
  fs.writeFileSync(filepath, report, 'utf-8')

  // Compact summary for delivery
  const t = data.trading
  const r = data.risk
  const h = data.health
  const dur = data.timeframe.durationHours.toFixed(1)

  console.log(`📊 Campaign Progress — ${targetId}`)
  console.log(`🕐 ${dur}h elapsed  |  Uptime: ${(h?.uptimeSec ?? 0) / 3600 | 0}h`)
  console.log(`📈 Trades: ${t?.totalTrades ?? 0}  |  Equity: $${r?.endEquity?.toFixed(0) ?? '?'}`)
  console.log(`💰 Gross PnL: ${t ? (t.grossPnL >= 0 ? '+' : '') + t.grossPnL.toFixed(0) : '?'}  |  Fees: ${t ? '-' + t.totalFees.toFixed(0) : '?'}`)
  console.log(`📉 Net PnL: ${t ? (t.netPnl >= 0 ? '+' : '') + t.netPnl.toFixed(0) : '?'}`)
  console.log(`📉 Max DD: ${r?.maxDrawdownPct.toFixed(1) ?? '?'}%`)
  console.log(`🟢 Health: ${h?.totalReconnects ?? 0} reconnects / ${h?.totalExceptions ?? 0} exceptions`)
  console.log(`💾 Snapshots: ${data.snapshotsUsed} valid`)
  console.log(`---`)
  console.log(`📄 Full report: reports/${filename}`)
}

main().catch(err => {
  console.error('Cron report error:', err.message)
  process.exit(1)
})
