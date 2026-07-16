// ── ReportExporter — Export backtest reports in various formats ──
//
// @since 3.5.3

import type { BacktestReport } from '../types'
import { ReportBuilder } from './ReportBuilder'

export class ReportExporter {
  /** Export as JSON */
  toJSON(report: BacktestReport): string {
    return JSON.stringify(report, null, 2)
  }

  /** Export as CSV (equity curve data if available) */
  toCSV(report: BacktestReport): string {
    const metrics = report.metrics
    if (!metrics) return 'No data'

    const header = 'key,value'
    const rows: string[] = [header]

    rows.push(`sessionId,${report.sessionId}`)
    rows.push(`name,${report.name}`)
    rows.push(`symbol,${report.config.symbol}`)
    rows.push(`timeframe,${report.config.timeframe}`)
    rows.push(`initialCash,${report.config.initialCash}`)
    rows.push(`startEquity,${metrics.equity.start}`)
    rows.push(`endEquity,${metrics.equity.current}`)
    rows.push(`peakEquity,${metrics.equity.peak}`)
    rows.push(`maxDrawdown,${metrics.equity.maxDrawdown}`)
    rows.push(`tradeCount,${metrics.tradeCount}`)
    rows.push(`barsProcessed,${report.duration.barsProcessed}`)
    rows.push(`elapsedMs,${report.duration.elapsedMs}`)

    for (const [key, value] of Object.entries(metrics.keyMetrics)) {
      rows.push(`${key},${value}`)
    }

    return rows.join('\n')
  }

  /** Export as plain text */
  toText(report: BacktestReport): string {
    const builder = new ReportBuilder()
    return builder.buildText(report)
  }

  /** Export as HTML (minimal report page) */
  toHTML(report: BacktestReport): string {
    const metrics = report.metrics
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${report.name} — Report</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 2em auto; padding: 0 1em; }
  h1 { color: #333; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
  th { background: #f5f5f5; }
  .positive { color: #16a34a; }
  .negative { color: #dc2626; }
  .meta { color: #666; font-size: 0.9em; }
</style>
</head>
<body>
<h1>${report.name}</h1>
<p class="meta">${report.config.symbol} · ${report.config.timeframe} · ${new Date(report.duration.completedAt).toLocaleString()}</p>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Initial Cash</td><td>$${report.config.initialCash.toLocaleString()}</td></tr>
  <tr><td>Start Equity</td><td>$${metrics?.equity.start.toLocaleString() ?? 'N/A'}</td></tr>
  <tr><td>End Equity</td><td class="${((metrics?.equity.current ?? 0) - (metrics?.equity.start ?? 0)) >= 0 ? 'positive' : 'negative'}">$${metrics?.equity.current.toLocaleString() ?? 'N/A'}</td></tr>
  <tr><td>Max Drawdown</td><td class="negative">${metrics ? (metrics.equity.maxDrawdown * 100).toFixed(2) + '%' : 'N/A'}</td></tr>
  <tr><td>Trades</td><td>${metrics?.tradeCount ?? 0}</td></tr>
  <tr><td>Bars Processed</td><td>${report.duration.barsProcessed}</td></tr>
  <tr><td>Duration</td><td>${(report.duration.elapsedMs / 1000).toFixed(1)}s</td></tr>
${Object.entries(metrics?.keyMetrics ?? {}).map(([k, v]) => `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toFixed(4) : v}</td></tr>`).join('\n')}
</table>
${report.errors?.length ? `<h2>Errors</h2><ul>${report.errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
</body>
</html>`
  }
}
