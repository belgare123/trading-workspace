// ── EquityCurve — Total portfolio equity over time ──
//
// @since 3.5.2

import type { Curve, TimePoint } from '../types'

export class EquityCurve implements Curve {
  readonly id = 'equity-curve'
  readonly name = 'Equity Curve'
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

  /** Starting equity */
  get start(): number {
    return this._points[0]?.value ?? 0
  }

  /** Final equity */
  get end(): number {
    return this._points[this._points.length - 1]?.value ?? 0
  }

  /** Highest equity */
  get peak(): number {
    return Math.max(...this._points.map(p => p.value), 0)
  }

  /** Lowest equity */
  get trough(): number {
    return Math.min(...this._points.map(p => p.value), 0)
  }
}
