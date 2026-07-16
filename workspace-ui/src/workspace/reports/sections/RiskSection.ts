// ── RiskSection — Risk metrics ──
//
// @since 3.5.5

import type { SectionView, RiskMetrics } from '../types'

export function buildRiskSection(
  metrics: { id: string; value: number }[],
): SectionView {
  const m = new Map(metrics.map(m => [m.id, m.value]))

  const data: RiskMetrics = {
    recoveryFactor: m.get('recovery-factor') ?? null,
    calmarRatio: m.get('calmar-ratio') ?? null,
    ulcerIndex: m.get('ulcer-index') ?? null,
    kellyCriterion: m.get('kelly-criterion') ?? null,
    sqn: m.get('sqn') ?? null,
  }

  return { type: 'risk', data }
}
