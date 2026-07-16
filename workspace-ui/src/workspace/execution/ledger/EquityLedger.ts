// ── EquityLedger — Portfolio equity tracking ──
//
// Calculates total equity = cash + portfolio value (positions MTM).
//
// @since 3.5.1

import type { EquitySnapshot, Position } from '../types'

export class EquityLedger {
  initialCash: number
  private snapshots: EquitySnapshot[] = []

  constructor(initialCash: number = 0) {
    this.initialCash = initialCash
  }

  /** Reset ledger to initial state (used by ExecutionRuntime.initialize) */
  seed(cash: number): void {
    this.initialCash = cash
    this.snapshots = []
  }

  /**
   * Calculate current equity snapshot.
   * Uses mark-to-market for open positions.
   */
  snapshot(cash: number, positions: Position[]): EquitySnapshot {
    const portfolioValue = positions.reduce((sum, p) => {
      return sum + p.currentPrice * p.quantity
    }, 0)

    const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)

    const snap: EquitySnapshot = {
      cash,
      positionsValue: portfolioValue,
      totalEquity: cash + portfolioValue,
      unrealizedPnl,
      timestamp: Date.now(),
    }
    this.snapshots.push(snap)
    return snap
  }

  /** Equity curve — all recorded snapshots */
  history(): EquitySnapshot[] {
    return [...this.snapshots]
  }

  /** Latest snapshot */
  latest(): EquitySnapshot | undefined {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : undefined
  }

  /** Total return (final equity / initial cash - 1) */
  get totalReturn(): number {
    const first = this.snapshots[0]
    const last = this.snapshots[this.snapshots.length - 1]
    if (!first || !last) return 0
    return (last.totalEquity - this.initialCash) / this.initialCash
  }

  /** Peak equity (for drawdown calculation) */
  get peakEquity(): number {
    return Math.max(...this.snapshots.map(s => s.totalEquity), this.initialCash)
  }

  /** Current drawdown from peak */
  get drawdown(): number {
    const current = this.latest()
    if (!current) return 0
    return (this.peakEquity - current.totalEquity) / this.peakEquity
  }

  clear(): void {
    this.snapshots = []
  }
}
