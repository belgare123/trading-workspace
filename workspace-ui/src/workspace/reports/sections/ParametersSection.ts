// ── ParametersSection — Strategy parameters display ──
//
// @since 3.5.5

import type { SectionView } from '../types'

export function buildParametersSection(
  params: Record<string, unknown>,
): SectionView {
  return { type: 'parameters', data: params }
}
