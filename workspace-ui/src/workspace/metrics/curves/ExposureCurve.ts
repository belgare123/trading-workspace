// ── ExposureCurve — Position exposure over time ──
//
// @since 3.5.2

import type { Curve, PositionEventData } from '../types'

export class ExposureCurve implements Curve {
  readonly id = 'exposure-curve'
  readonly name = 'Exposure Curve'
  private _points: { timestamp: number; value: number }[]

  constructor(positionEvents: PositionEventData[]) {
    this._points = computeExposure(positionEvents)
  }

  get points() {
    return [...this._points]
  }

  /** Maximum exposure */
  get maxExposure(): number {
    return Math.max(...this._points.map(p => p.value), 0)
  }

  /** Average exposure */
  get avgExposure(): number {
    if (this._points.length === 0) return 0
    return this._points.reduce((s, p) => s + p.value, 0) / this._points.length
  }

  /** Exposure as % of equity (approximate) */
  exposureRatio(): number {
    const max = this.maxExposure
    const maxEquity = this._points.reduce((s, p) => Math.max(s, p.value * 2 + 10000), 10000)
    return maxEquity === 0 ? 0 : max / maxEquity
  }
}

function computeExposure(
  events: PositionEventData[],
): { timestamp: number; value: number }[] {
  const points: { timestamp: number; value: number }[] = []
  let netExposure = 0

  for (const evt of events) {
    if (evt.type === 'OPENED') {
      netExposure += evt.quantity * evt.entryPrice
    } else if (evt.type === 'CLOSED') {
      netExposure = 0
    }
    // UPDATED: recalculate
    if (evt.type === 'UPDATED') {
      // approximate: quantity * currentPrice
      netExposure = evt.quantity * evt.entryPrice
    }

    points.push({
      timestamp: evt.timestamp,
      value: netExposure,
    })
  }

  return points
}
