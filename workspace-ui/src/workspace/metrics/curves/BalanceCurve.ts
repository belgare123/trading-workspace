// ── BalanceCurve — Cash balance over time ──
//
// @since 3.5.2

import type { Curve, TimePoint } from '../types'

export class BalanceCurve implements Curve {
  readonly id = 'balance-curve'
  readonly name = 'Balance Curve'
  private _points: TimePoint[]

  constructor(points: TimePoint[]) {
    this._points = points
  }

  get points() {
    return this._points.map(p => ({
      timestamp: p.timestamp,
      value: p.value,
    }))
  }

  /** Starting balance */
  get start(): number {
    return this._points[0]?.value ?? 0
  }

  /** Current balance */
  get end(): number {
    return this._points[this._points.length - 1]?.value ?? 0
  }
}
