// ── PerformanceSection — Equity / Balance / Drawdown / Exposure ──
//
// @since 3.5.5

import type { SectionView, ChartPoint } from '../types'

export function buildPerformanceSection(
  curves: { id: string; name: string; points: { timestamp: number; value: number }[] }[],
): SectionView {
  const find = (id: string): ChartPoint[] =>
    curves.find(c => c.id === id)?.points.map(p => ({ timestamp: p.timestamp, value: p.value })) ?? []

  return {
    type: 'equity',
    data: {
      equityCurve: find('equity-curve'),
      balanceCurve: find('balance-curve'),
      drawdownCurve: find('drawdown-curve'),
      exposureCurve: find('exposure-curve'),
    },
  }
}
