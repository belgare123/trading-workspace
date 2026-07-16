/**
 * TimeScale.ts — time axis logic
 *
 * Computes tick positions, label formatting, and grid lines
 * for the chart's time (X) axis.
 *
 * Pure logic — no React, no DOM.
 *
 * @since 3.3.1
 */

import type { TimeScaleOptions } from '../types'

export interface TimeTick {
  timestamp: number
  label: string
  pixelX: number
}

export interface TimeLabelFormat {
  /** Full format (e.g. '2024-01-15 14:30') */
  full: (ts: number) => string
  /** Short format for dense ticks */
  short: (ts: number) => string
}

/**
 * TimeScale — time axis tick computation
 *
 * Given a time scale (from/to range + interval), produces
 * an array of tick positions with formatted labels.
 */
export class TimeScale {
  options: TimeScaleOptions
  formatters?: TimeLabelFormat

  constructor(options: TimeScaleOptions, formatters?: TimeLabelFormat) {
    this.options = options
    this.formatters = formatters
  }

  /** Default date formatters */
  static defaultFormatters: TimeLabelFormat = {
    full: (ts: number) => {
      const d = new Date(ts)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
    short: (ts: number) => {
      const d = new Date(ts)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    },
  }

  /** Compute tick positions for the current range */
  getTicks(canvasWidth: number, zoomX: number): TimeTick[] {
    const { from, to } = this.options
    const range = to - from
    if (range <= 0 || !this.options.visible) return []

    const fmt = this.formatters ?? TimeScale.defaultFormatters
    const ticks: TimeTick[] = []

    // Determine tick interval based on range
    const tickIntervalMs = this._estimateTickInterval(range)

    // Round 'from' to the nearest tick interval
    let tick = Math.ceil(from / tickIntervalMs) * tickIntervalMs

    while (tick <= to) {
      const ratio = (tick - from) / range
      const pixelX = ratio * canvasWidth * zoomX
      const label = this._isMajorTick(tick, tickIntervalMs)
        ? fmt.full(tick)
        : fmt.short(tick)
      ticks.push({ timestamp: tick, label, pixelX })
      tick += tickIntervalMs
    }

    return ticks
  }

  /** Estimate a reasonable tick interval for the visible range */
  private _estimateTickInterval(rangeMs: number): number {
    // Target ~8-12 ticks visible
    const targetTicks = 10
    const rawInterval = rangeMs / targetTicks

    // Round to a nice interval
    const niceIntervals = [
      1_000,          // 1s
      5_000,          // 5s
      15_000,         // 15s
      30_000,         // 30s
      60_000,         // 1m
      300_000,        // 5m
      900_000,        // 15m
      1_800_000,      // 30m
      3_600_000,      // 1h
      14_400_000,     // 4h
      86_400_000,     // 1d
      604_800_000,    // 1w
      2_592_000_000,  // ~30d
    ]

    for (const nice of niceIntervals) {
      if (rawInterval <= nice) return nice
    }

    return niceIntervals[niceIntervals.length - 1]
  }

  /** Determine if a tick should use the full label format */
  private _isMajorTick(timestamp: number, tickIntervalMs: number): boolean {
    // Major ticks for daily or longer intervals
    if (tickIntervalMs >= 86_400_000) return true
    // Every hour is major for sub-hour intervals
    if (tickIntervalMs < 3_600_000) {
      const d = new Date(timestamp)
      return d.getMinutes() === 0
    }
    // Every 24h mark is major
    const d = new Date(timestamp)
    return d.getHours() === 0 && d.getMinutes() === 0
  }
}
