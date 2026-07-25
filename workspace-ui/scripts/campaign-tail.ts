#!/usr/bin/env node
/**
 * campaign-tail.ts — Live campaign dashboard (tail -f for paper campaign)
 *
 * Reads latest metrics from the campaign state directory and prints a
 * compact, human-readable status panel.
 *
 * Usage:
 *   npx tsx scripts/campaign-tail.ts
 *   npx tsx scripts/campaign-tail.ts --watch    # auto-refresh every 10s
 *   npx tsx scripts/campaign-tail.ts --dir /tmp/paper-campaign
 *
 * @since Sprint M1.1
 */

import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

interface Dashboard {
  stage: string
  uptime: string
  pnl: string
  equity: string
  balance: string
  openPositions: number
  openOrders: number
  trades: number
  winRate: string
  winCount: number
  lossCount: number
  profitFactor: string
  fees: string
  feedStatus: string
  brokerStatus: string
  strategyStatus: string
  certResult: string
  memoryMB: number
  reconnects: number
  exceptions: number
  lastEventAge: string
  snapshotCount: number
  lastSnapshotAge: string
}

function parseArgs(): { dir: string; watch: boolean; interval: number } {
  const args = process.argv.slice(2)
  let dir = join(tmpdir(), 'paper-campaign')
  let watch = false
  let interval = 10
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && i + 1 < args.length) dir = args[++i]
    else if (args[i] === '--watch' || args[i] === '-w') watch = true
    else if (args[i] === '--interval' && i + 1 < args.length) interval = parseInt(args[++i], 10)
  }
  return { dir, watch, interval }
}

function fmtUsd(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function fmtAge(ms: number): string {
  if (ms < 1000) return 'now'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.round(ms / 3_600_000)}h`
}

function collectDashboard(dir: string): Dashboard {
  const d: Dashboard = {
    stage: '?', uptime: '?', pnl: '?', equity: '?', balance: '?',
    openPositions: 0, openOrders: 0, trades: 0, winRate: '?',
    winCount: 0, lossCount: 0, profitFactor: '?', fees: '?',
    feedStatus: '?', brokerStatus: '?', strategyStatus: '?',
    certResult: '?', memoryMB: 0, reconnects: 0, exceptions: 0,
    lastEventAge: '?', snapshotCount: 0, lastSnapshotAge: '?',
  }

  // ── Campaign state.json ──
  const statePath = join(dir, 'state.json')
  if (existsSync(statePath)) {
    try {
      const s = JSON.parse(readFileSync(statePath, 'utf8'))
      d.stage = s.stage ?? '?'
      d.uptime = s.uptime ?? '?'
      d.exceptions = s.exceptionsCount ?? 0
      d.reconnects = s.reconnectCount ?? 0
      d.certResult = s.lastCertResult ?? 'N/A'
      d.memoryMB = s.memoryMB ?? 0
      if (s.lastMarketEventAgeMs !== undefined) {
        d.lastEventAge = fmtAge(s.lastMarketEventAgeMs)
      }
    } catch { /* skip */ }
  }

  // ── Metrics state.json (rich snapshot) ──
  const metricsPath = join(dir, 'metrics', 'state.json')
  if (existsSync(metricsPath)) {
    try {
      const m = JSON.parse(readFileSync(metricsPath, 'utf8'))

      if (m.trading) {
        const t = m.trading
        d.balance = fmtUsd(t.freeBalance ?? 0)
        d.equity = fmtUsd(t.equity ?? 0)
        d.pnl = fmtUsd(t.realisedPnl ?? 0)
        d.fees = fmtUsd(t.totalFees ?? 0)
        d.openPositions = t.openPositions ?? 0
        d.openOrders = t.activeOrders ?? 0
        d.trades = t.tradesRecorded ?? 0
        d.winCount = t.winningTrades ?? 0
        d.lossCount = t.losingTrades ?? 0

        const total = (t.winningTrades ?? 0) + (t.losingTrades ?? 0)
        if (total > 0) {
          d.winRate = `${((t.winningTrades / total) * 100).toFixed(1)}%`
        }

        if (t.totalGrossProfit && t.totalGrossLoss && t.totalGrossLoss > 0) {
          d.profitFactor = (t.totalGrossProfit / Math.abs(t.totalGrossLoss)).toFixed(2)
        }
      }

      if (m.health) {
        d.feedStatus = m.health.feed?.status ?? '?'
        d.brokerStatus = m.health.broker?.status ?? '?'
        d.strategyStatus = m.health.strategy?.status ?? '?'
      }

      d.lastSnapshotAge = m.timestamp ? fmtAge(Date.now() - m.timestamp) : '?'
    } catch { /* skip */ }
  }

  // ── Snapshots count ──
  const snapshotsPath = join(dir, 'metrics', 'snapshots.jsonl')
  if (existsSync(snapshotsPath)) {
    try {
      const lines = readFileSync(snapshotsPath, 'utf8').trim().split('\n').filter(Boolean)
      d.snapshotCount = lines.length
    } catch { /* skip */ }
  }

  return d
}

function render(d: Dashboard): string {
  const statusIcon = (s: string) =>
    s === 'healthy' ? '✅' : s === 'degraded' ? '⚠️' : s === '? ' ? '⏳' : '❌'

  const lines: string[] = [
    '',
    '┌─── Paper Campaign ─────────────────────────────────┐',
    `  Stage           │ ${d.stage.padEnd(36)}│`,
    `  Uptime          │ ${d.uptime.padEnd(36)}│`,
    '──────────────────────────────────────────────────────',
    `  Equity          │ ${d.equity.padEnd(36)}│`,
    `  Balance (USDT)  │ ${d.balance.padEnd(36)}│`,
    `  PnL             │ ${d.pnl.padEnd(36)}│`,
    `  Total Fees      │ ${d.fees.padEnd(36)}│`,
    '──────────────────────────────────────────────────────',
    `  Open positions  │ ${String(d.openPositions).padEnd(36)}│`,
    `  Open orders     │ ${String(d.openOrders).padEnd(36)}│`,
    `  Trades          │ ${String(d.trades).padEnd(36)}│`,
    `  Win / Loss      │ ${d.winCount}W / ${d.lossCount}L${' '.repeat(28 - String(d.winCount + d.lossCount).length)}│`,
    `  Win Rate        │ ${d.winRate.padEnd(36)}│`,
    `  Profit Factor   │ ${d.profitFactor.padEnd(36)}│`,
    '──────────────────────────────────────────────────────',
    `  Feed            │ ${statusIcon(d.feedStatus)} ${d.feedStatus.padEnd(31)}│`,
    `  Broker          │ ${statusIcon(d.brokerStatus)} ${d.brokerStatus.padEnd(31)}│`,
    `  Strategy        │ ${statusIcon(d.strategyStatus)} ${d.strategyStatus.padEnd(31)}│`,
    `  Certification   │ ${d.certResult.padEnd(36)}│`,
    '──────────────────────────────────────────────────────',
    `  RSS             │ ${String(d.memoryMB).padEnd(6)} MB ${' '.repeat(28)}│`,
    `  Reconnects      │ ${String(d.reconnects).padEnd(34)}│`,
    `  Exceptions      │ ${String(d.exceptions).padEnd(34)}│`,
    `  Last event age  │ ${d.lastEventAge.padEnd(36)}│`,
    `  Snapshots       │ ${String(d.snapshotCount).padEnd(7)} (last: ${d.lastSnapshotAge})${' '.repeat(18)}│`,
    '└──────────────────────────────────────────────────────┘',
    '',
  ]
  return lines.join('\n')
}

// ── Main ──

function main(): void {
  const { dir, watch, interval } = parseArgs()

  if (!watch) {
    console.log(render(collectDashboard(dir)))
    return
  }

  // Watch mode
  console.log(`📡 Watching ${dir} (refresh every ${interval}s) — Ctrl+C to stop\n`)

  function tick(): void {
    // Clear previous output
    const d = collectDashboard(dir)
    const output = render(d)
    console.log(output)
  }

  tick()
  setInterval(tick, interval * 1000)

  // Handle exit gracefully
  process.on('SIGINT', () => {
    process.exit(0)
  })
}

main()
