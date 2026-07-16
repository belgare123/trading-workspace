/**
 * ChartViewport.ts — pan/zoom and coordinate transformations
 *
 * Converts between chart data coordinates (timestamps, prices)
 * and pixel coordinates on the chart canvas.
 *
 * Pure math — no React, no DOM.
 *
 * @since 3.3.1
 */

import type { ViewportState, TimeScaleOptions, PriceScaleOptions } from '../types'

export interface PixelPoint {
  x: number
  y: number
}

export interface DataPoint {
  timestamp: number
  price: number
}

/**
 * ChartViewport — coordinate transformation engine
 *
 * Converts between:
 *   - Data space (timestamp, price)
 *   - Pixel space (x, y on canvas)
 *
 * Pure math — no side effects, no DOM.
 */
export class ChartViewport {
  viewport: ViewportState
  timeScale: TimeScaleOptions
  priceScale: PriceScaleOptions
  canvasWidth: number
  canvasHeight: number

  constructor(
    viewport: ViewportState,
    timeScale: TimeScaleOptions,
    priceScale: PriceScaleOptions,
    canvasWidth: number = 800,
    canvasHeight: number = 600,
  ) {
    this.viewport = viewport
    this.timeScale = timeScale
    this.priceScale = priceScale
    this.canvasWidth = canvasWidth
    this.canvasHeight = canvasHeight
  }

  // ── Configuration ──

  /** Update canvas dimensions */
  setSize(width: number, height: number): void {
    this.canvasWidth = width
    this.canvasHeight = height
  }

  // ── Time → pixel ──

  /** Convert a timestamp to pixel x-coordinate */
  timeToPixel(timestamp: number): number {
    const { from, to } = this.timeScale
    const range = to - from
    if (range <= 0) return 0
    const ratio = (timestamp - from) / range
    return ratio * this.canvasWidth * this.viewport.zoomX + this.viewport.offsetX
  }

  /** Convert pixel x-coordinate to timestamp */
  pixelToTime(pixelX: number): number {
    const { from, to } = this.timeScale
    const range = to - from
    if (range <= 0) return from
    const effectiveWidth = this.canvasWidth * this.viewport.zoomX
    if (effectiveWidth <= 0) return from
    const ratio = (pixelX - this.viewport.offsetX) / effectiveWidth
    return from + ratio * range
  }

  // ── Price → pixel ──

  /** Convert a price to pixel y-coordinate */
  priceToPixel(price: number): number {
    const { fixedMin, fixedMax, inverted, logarithmic } = this.priceScale
    const min = fixedMin ?? 0
    const max = fixedMax ?? (price * 1.1)
    const range = max - min
    if (range <= 0) return 0

    let ratio: number
    if (logarithmic && min > 0 && max > 0) {
      const logMin = Math.log(min)
      const logMax = Math.log(max)
      const logPrice = Math.log(price)
      ratio = (logPrice - logMin) / (logMax - logMin)
    } else {
      ratio = (price - min) / range
    }

    const clamped = Math.max(0, Math.min(1, ratio))
    return inverted
      ? clamped * this.canvasHeight * this.viewport.zoomY
      : (1 - clamped) * this.canvasHeight * this.viewport.zoomY
  }

  /** Convert pixel y-coordinate to price */
  pixelToPrice(pixelY: number): number {
    const { fixedMin, fixedMax, inverted, logarithmic } = this.priceScale
    const min = fixedMin ?? 0
    const max = fixedMax ?? 100
    const range = max - min
    if (range <= 0) return min

    const effectiveHeight = this.canvasHeight * this.viewport.zoomY
    if (effectiveHeight <= 0) return min

    const ratio = inverted
      ? pixelY / effectiveHeight
      : 1 - pixelY / effectiveHeight

    const clamped = Math.max(0, Math.min(1, ratio))

    if (logarithmic && min > 0 && max > 0) {
      const logMin = Math.log(min)
      const logMax = Math.log(max)
      return Math.exp(logMin + clamped * (logMax - logMin))
    }

    return min + clamped * (max - min)
  }

  // ── Utility ──

  /** Get the visible data range as [fromTimestamp, toTimestamp] */
  getVisibleTimeRange(): [number, number] {
    return [this.timeScale.from, this.timeScale.to]
  }

  /** Get the visible price range */
  getVisiblePriceRange(): [number, number] {
    return [
      this.priceScale.fixedMin ?? 0,
      this.priceScale.fixedMax ?? 100,
    ]
  }

  /** Check if a timestamp is visible in the current viewport */
  isTimestampVisible(timestamp: number): boolean {
    return timestamp >= this.timeScale.from && timestamp <= this.timeScale.to
  }
}
