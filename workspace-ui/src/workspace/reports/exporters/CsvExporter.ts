// ── CsvExporter — Export report sections to CSV ──
//
// @since 3.5.5

import type { SectionView } from '../types'

export class CsvExporter {
  exportSection(section: SectionView): string {
    switch (section.type) {
      case 'summary':
        return this.toCsv(
          ['Metric', 'Value'],
          Object.entries(section.data).map(([k, v]) => [k, v !== null ? String(v) : '']),
        )
      case 'trades':
        return this.toCsv(
          ['Index', 'Timestamp', 'Symbol', 'Direction', 'P/L'],
          section.data.tradeList.map(t => [t.index, new Date(t.timestamp).toISOString(), t.symbol, t.direction, t.pnl]),
        )
      case 'optimization':
        return this.toCsv(
          ['Rank', 'Trial ID', 'Score'],
          section.data.leaderboard.map(r => [r.rank, r.trialId, r.score ?? '']),
        )
      default:
        return ''
    }
  }

  private toCsv(header: string[], rows: (string | number)[][]): string {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    return [header.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  }
}
