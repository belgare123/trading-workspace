// ── EquityCollector — Collects equity/balance data from ExecutionEventBus ──
//
// Listens to EQUITY_CHANGED events. Provides equity curve and drawdown.
//
// @since 3.5.2

import type { EquitySnapshot, Collector, EventBusHandle, TimePoint, DrawdownPoint } from '../types'

export class EquityCollector implements Collector {
  readonly id = 'equity-collector'
  private _snapshots: EquitySnapshot[] = []
  private _equityPoints: TimePoint[] = []
  private _balancePoints: TimePoint[] = []
  private unsub: (() => void) | null = null

  connect(bus: EventBusHandle): void {
    this.unsub = bus.on('EQUITY_CHANGED', event => {
      this._snapshots.push(event.equity)
      this._equityPoints.push({
        timestamp: event.timestamp,
        value: event.equity.totalEquity,
      })
      this._balancePoints.push({
        timestamp: event.timestamp,
        value: event.equity.cash,
      })
    })
  }

  /** All equity snapshots */
  get snapshots(): EquitySnapshot[] {
    return [...this._snapshots]
  }

  /** Latest equity snapshot */
  get latest(): EquitySnapshot | undefined {
    return this._snapshots[this._snapshots.length - 1]
  }

  /** Equity curve points (total equity over time) */
  get equityPoints(): TimePoint[] {
    return [...this._equityPoints]
  }

  /** Balance curve points (cash over time) */
  get balancePoints(): TimePoint[] {
    return [...this._balancePoints]
  }

  /** Total return from first to last snapshot */
  get totalReturn(): number {
    if (this._snapshots.length < 2) return 0
    const first = this._snapshots[0]
    const last = this._snapshots[this._snapshots.length - 1]
    return last.totalEquity - first.totalEquity
  }

  /** Total return percentage */
  get totalReturnPct(): number {
    if (this._snapshots.length < 2) return 0
    const first = this._snapshots[0]
    const last = this._snapshots[this._snapshots.length - 1]
    return first.totalEquity === 0 ? 0 : (last.totalEquity - first.totalEquity) / first.totalEquity
  }

  /** Drawdown curve — peak-to-trough decline */
  getDrawdownCurve(): DrawdownPoint[] {
    const points = this._equityPoints
    if (points.length === 0) return []

    const result: DrawdownPoint[] = []
    let peak = points[0].value

    for (const pt of points) {
      if (pt.value > peak) peak = pt.value
      const drawdown = peak > 0 ? (peak - pt.value) / peak : 0
      result.push({
        timestamp: pt.timestamp,
        value: drawdown,
        peak,
        drawdownPct: drawdown,
      })
    }
    return result
  }

  /** Maximum drawdown */
  get maxDrawdown(): number {
    const curve = this.getDrawdownCurve()
    if (curve.length === 0) return 0
    return Math.max(...curve.map(c => c.drawdownPct))
  }

  /** Current equity */
  get currentEquity(): number {
    return this._snapshots[this._snapshots.length - 1]?.totalEquity ?? 0
  }

  reset(): void {
    this._snapshots = []
    this._equityPoints = []
    this._balancePoints = []
    this.unsub?.()
    this.unsub = null
  }
}
