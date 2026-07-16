// ── BacktestReport — Final aggregated backtest report ──
//
// Combines session metadata with metrics snapshot.
// No computation — pure data model.
//
// @since 3.5.3

import type { BacktestConfig } from '../types'
import type { MetricsSnapshot } from '../../metrics/serialization/MetricsSnapshot'

export interface BacktestReport {
  sessionId: string
  name: string
  config: BacktestConfig
  metrics: MetricsSnapshot | null
  duration: {
    startedAt: number
    completedAt: number
    elapsedMs: number
    barsProcessed: number
    barsPerSecond: number
  }
  errors?: string[]
}
