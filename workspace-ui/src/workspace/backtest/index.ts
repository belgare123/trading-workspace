// ── Backtest Module — Barrel Export ──
//
// Sprint 3.5.3 — Backtest Runtime
//
// @since 3.5.3

// ── Types ──
export type {
  SessionStatus,
  BacktestConfig,
  BacktestProgress,
  BacktestFeed,
  SpeedPreset,
  PlaybackState,
  SessionClock,
  BacktestReport,
  BacktestTemplate,
  StrategyExecutor,
  BacktestSessionInfo,
} from './types'

// ── Feed ──
export { HistoricalFeed } from './feed/HistoricalFeed'
export { FeedCursor } from './feed/FeedCursor'
export { FeedCache } from './feed/FeedCache'
export { FeedWindow } from './feed/FeedWindow'

// ── Control ──
export { PlaybackController } from './control/PlaybackController'
export { PlaybackSpeed } from './control/PlaybackSpeed'
export { StepController } from './control/StepController'
export { SessionClock as SessionClockClass } from './control/SessionClock'

// ── Runtime ──
export { BacktestRuntime } from './runtime/BacktestRuntime'
export { BacktestSession } from './runtime/BacktestSession'
export { BacktestScheduler } from './runtime/BacktestScheduler'
export { SessionState } from './runtime/SessionState'

// ── Report ──
export type { ReportSnapshotData } from './report/ReportSnapshot'
export { createReportSnapshot } from './report/ReportSnapshot'
export { ReportBuilder } from './report/ReportBuilder'
export { ReportExporter } from './report/ReportExporter'

// ── Persistence ──
export { SessionSerializer } from './persistence/SessionSerializer'
export { SessionMigration } from './persistence/SessionMigration'

// ── Templates ──
export { DefaultBacktest } from './templates/DefaultBacktest'
export { WalkForward } from './templates/WalkForward'
export { MonteCarlo } from './templates/MonteCarlo'
