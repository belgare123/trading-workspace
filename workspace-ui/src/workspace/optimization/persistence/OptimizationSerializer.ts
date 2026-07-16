// ── OptimizationSerializer — Save/load optimization state ──
//
// @since 3.5.4

import type { OptimizationSessionInfo, TrialResult } from '../types'

export interface OptimizationState {
  version: string
  session: OptimizationSessionInfo
  trials: TrialResult[]
  savedAt: number
}

export class OptimizationSerializer {
  private static readonly CURRENT_VERSION = '3.5.4'

  /** Serialize optimization session to JSON */
  serialize(session: OptimizationSessionInfo, trials: TrialResult[]): string {
    const state: OptimizationState = {
      version: OptimizationSerializer.CURRENT_VERSION,
      session,
      trials,
      savedAt: Date.now(),
    }
    return JSON.stringify(state, null, 2)
  }

  /** Deserialize optimization state from JSON */
  deserialize(json: string): OptimizationState {
    const state = JSON.parse(json) as OptimizationState

    // Validate version
    if (!state.version) {
      throw new Error('Invalid optimization state: missing version')
    }

    // Future: migrate old versions
    return state
  }

  /** Export best trials as backtest configs */
  exportBestConfigs(
    trials: TrialResult[],
    topN: number = 3,
    scoreCompare: (a: TrialResult, b: TrialResult) => number =
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
  ): Record<string, unknown>[] {
    return [...trials]
      .filter(t => t.status === 'completed' && t.score !== null)
      .sort(scoreCompare)
      .slice(0, topN)
      .map(t => ({
        params: t.parameters,
        score: t.score,
      }))
  }
}
