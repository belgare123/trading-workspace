// ── ExecutionDefinition — Contract for an execution simulator ──
//
// Defines what every execution simulation must implement.
// Enables pluggable simulation modes:
//   - PaperTradeExecution
//   - BacktestExecution
//   - LiveExecution (broker adapter, future)
//
// @since 3.5.1

import type { ExecutionConfig, MarketSnapshot, ExecutionResult } from '../types'

export interface ExecutionDefinition {
  readonly id: string
  readonly name: string
  readonly description: string

  /** Initialize the simulator with config */
  initialize(config: ExecutionConfig): void

  /** Process one bar/tick */
  onBar(params: { symbol: string; bar: MarketSnapshot }): Promise<ExecutionResult>

  /** Current state summary */
  getStatus(): ExecutionStatus
}

export interface ExecutionStatus {
  id: string
  running: boolean
  barCount: number
  orderCount: number
  fillCount: number
  positions: number
  equity: number
  cash: number
}
