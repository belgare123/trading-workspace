/**
 * ExecutionMode.ts — Execution gateway modes
 *
 * Defines the three execution modes:
 * - simulation: backtesting (existing BacktestRuntime)
 * - paper:      virtual orders on real market data
 * - live:       real orders via BrokerAdapter
 *
 * @since 4.1
 */

export const ExecutionMode = {
  Simulation: 'simulation',
  Paper: 'paper',
  Live: 'live',
} as const

export type ExecutionMode = (typeof ExecutionMode)[keyof typeof ExecutionMode]

/** Human-readable labels for each mode */
export const EXECUTION_MODE_LABELS: Record<ExecutionMode, string> = {
  [ExecutionMode.Simulation]: 'Simulation / Backtest',
  [ExecutionMode.Paper]: 'Paper Trading (Dry Run)',
  [ExecutionMode.Live]: 'Live Trading',
}

/** Mode display colors */
export const EXECUTION_MODE_COLORS: Record<ExecutionMode, string> = {
  [ExecutionMode.Simulation]: '#6b7280',
  [ExecutionMode.Paper]: '#f59e0b',
  [ExecutionMode.Live]: '#ef4444',
}
