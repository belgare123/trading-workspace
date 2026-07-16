// ── DrawdownCurve — Drawdown over time ──
//
// @since 3.5.2

import type { Curve, DrawdownPoint, TimePoint } from '../types'

export class DrawdownCurve implements Curve {
  readonly id = 'drawdown-curve'
  readonly name = 'Drawdown Curve'
  private _points: DrawdownPoint[]

  constructor(equityPoints: TimePoint[]) {
    this._points = computeDrawdown(equityPoints)
  }

  get points() {
    return this._points.map(p => ({
      timestamp: p.timestamp,
      value: p.drawdownPct,
      label: p.peak > p.value ? 'Drawdown' : 'Peak',
    }))
  }

  get drawdownPoints(): DrawdownPoint[] {
    return [...this._points]
  }

  /** Maximum drawdown value */
  get maxDrawdown(): number {
    return Math.max(...this._points.map(p => p.drawdownPct), 0)
  }
}

function computeDrawdown(points: TimePoint[]): DrawdownPoint[] {
  if (points.length === 0) return []

  const result: DrawdownPoint[] = []
  let peak = points[0].value

  for (const pt of points) {
    if (pt.value > peak) peak = pt.value
    const dd = peak > 0 ? (peak - pt.value) / peak : 0
    result.push({ timestamp: pt.timestamp, value: dd, peak, drawdownPct: dd })
  }

  return result
}
