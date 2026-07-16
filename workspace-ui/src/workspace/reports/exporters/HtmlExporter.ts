// ── HtmlExporter — Export ReportView to HTML ──
//
// @since 3.5.5

import type { ReportView, SectionView } from '../types'

export class HtmlExporter {
  export(report: ReportView): string {
    const parts: string[] = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head><meta charset="UTF-8"><title>',
      report.name,
      '</title>',
      '<style>',
      'body{font-family:system-ui,sans-serif;max-width:1200px;margin:0 auto;padding:20px;background:#fafafa}',
      'h1{color:#1a1a2e}h2{color:#16213e;border-bottom:2px solid #0f3460;padding-bottom:4px}',
      'table{border-collapse:collapse;width:100%;margin:8px 0 16px}',
      'th,td{border:1px solid #ddd;padding:6px 10px;text-align:right}',
      'th{background:#0f3460;color:#fff}td{background:#fff}',
      '.summary{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}',
      '.card{background:#fff;border-radius:8px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.1)}',
      '.card label{display:block;font-size:11px;color:#666;text-transform:uppercase}',
      '.card .value{font-size:20px;font-weight:700;color:#1a1a2e}',
      '.section{margin:24px 0}',
      '</style></head><body>',
      `<h1>${report.name}</h1>`,
      `<p>Generated: ${new Date(report.generatedAt).toISOString()} | Type: ${report.type}</p>`,
    ]

    for (const section of report.sections) {
      parts.push(this.renderSection(section))
    }

    parts.push('</body></html>')
    return parts.join('\n')
  }

  private renderSection(section: SectionView): string {
    switch (section.type) {
      case 'summary':
        return this.renderSummary(section.data)
      case 'equity':
        return this.renderEquity(section.data)
      case 'risk':
        return this.renderRisk(section.data)
      case 'trades':
        return this.renderTrades(section.data)
      case 'optimization':
        return this.renderOptimization(section.data)
      case 'parameters':
        return this.renderParameters(section.data)
      default:
        return ''
    }
  }

  private renderSummary(data: { netProfit: number | null; cagr: number | null; sharpe: number | null; sortino: number | null; maxDrawdown: number | null; profitFactor: number | null; winRate: number | null; expectancy: number | null; totalTrades: number }): string {
    const cards = [
      ['Net Profit', data.netProfit],
      ['CAGR', data.cagr],
      ['Sharpe', data.sharpe],
      ['Sortino', data.sortino],
      ['Max DD', data.maxDrawdown],
      ['Profit Factor', data.profitFactor],
      ['Win Rate', data.winRate],
      ['Expectancy', data.expectancy],
      ['Trades', data.totalTrades],
    ]
    return `<div class="section"><h2>Executive Summary</h2><div class="summary">${
      cards.map(([label, value]) =>
        `<div class="card"><label>${label}</label><div class="value">${typeof value === 'number' ? value.toFixed(2) : '—'}</div></div>`,
      ).join('')
    }</div></div>`
  }

  private renderEquity(data: { equityCurve: { timestamp: number; value: number }[] }): string {
    return `<div class="section"><h2>Equity Analysis</h2><p>${data.equityCurve.length} data points</p></div>`
  }

  private renderRisk(data: { recoveryFactor: number | null; calmarRatio: number | null; ulcerIndex: number | null; kellyCriterion: number | null; sqn: number | null }): string {
    return `<div class="section"><h2>Risk Analytics</h2><table><tr>${
      ['Recovery Factor', 'Calmar', 'Ulcer', 'Kelly', 'SQN'].map(l => `<th>${l}</th>`).join('')
    }</tr><tr>${
      [data.recoveryFactor, data.calmarRatio, data.ulcerIndex, data.kellyCriterion, data.sqn]
        .map(v => `<td>${v !== null ? v.toFixed(4) : '—'}</td>`).join('')
    }</tr></table></div>`
  }

  private renderTrades(data: { tradeList: { index: number; symbol: string; direction: string; pnl: number }[] }): string {
    return `<div class="section"><h2>Trade Analytics</h2><p>${data.tradeList.length} trades</p></div>`
  }

  private renderOptimization(data: { report: { trialCount: number; completedCount: number } }): string {
    return `<div class="section"><h2>Optimization</h2><p>${data.report.completedCount}/${data.report.trialCount} trials completed</p></div>`
  }

  private renderParameters(data: Record<string, unknown>): string {
    const rows = Object.entries(data).map(([k, v]) => `<tr><td>${k}</td><td>${String(v)}</td></tr>`).join('')
    return `<div class="section"><h2>Strategy Parameters</h2><table><tr><th>Parameter</th><th>Value</th></tr>${rows}</table></div>`
  }
}
