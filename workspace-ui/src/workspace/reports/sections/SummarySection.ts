// ── SummarySection — Executive Summary ──
//
// @since 3.5.5

import type { MetricsSnapshot } from '../../metrics/serialization/MetricsSnapshot'
import type { SummaryMetrics, SectionView } from '../types'

export function buildSummarySection(
  snapshot: MetricsSnapshot,
  tradeCount?: number,
): SectionView {
  const m = snapshot.keyMetrics

  const data: SummaryMetrics = {
    netProfit: m['net-profit'] ?? null,
    cagr: m['cagr'] ?? null,
    sharpe: m['sharpe-ratio'] ?? null,
    sortino: m['sortino-ratio'] ?? null,
    maxDrawdown: snapshot.equity.maxDrawdown,
    profitFactor: m['profit-factor'] ?? null,
    winRate: m['win-rate'] ?? null,
    expectancy: m['expectancy'] ?? null,
    totalTrades: tradeCount ?? snapshot.tradeCount,
  }

  return { type: 'summary', data }
}
