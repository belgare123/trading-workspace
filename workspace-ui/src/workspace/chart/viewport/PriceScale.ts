/**
 * PriceScale.ts — price axis logic
 *
 * Computes tick positions, label formatting, and grid lines
 * for the chart's price (Y) axis.
 *
 * Pure logic — no React, no DOM.
 *
 * @since 3.3.1
 */

import type { PriceScaleOptions } from '../types'

export interface PriceTick {
  price: number
  label: string
  pixelY: number
}

/**
 * PriceScale — price axis tick computation
 *
 * Given a price scale (min/max range + options), produces
 * an array of tick positions with formatted labels.
 */
export class PriceScale {
  options: PriceScaleOptions
  formatter?: (price: number) => string

  constructor(options: PriceScaleOptions, formatter?: (price: number) => string) {
    this.options = options
    this.formatter = formatter
  }

  /** Default price formatter */
  static defaultFormatter(price: number): string {
    if (Math.abs(price) >= 1_000_000) return `${(price / 1_000_000).toFixed(2)}M`
    if (Math.abs(price) >= 1_000) return `${(price / 1_000).toFixed(2)}K`
    if (price >= 1) return price.toFixed(2)
    if (price > 0) return price.toFixed(6)
    return price.toFixed(2)
  }

  /** Compute tick positions for the current price range */
  getTicks(canvasHeight: number, zoomY: number): PriceTick[] {
    const { fixedMin, fixedMax, inverted, visible } = this.options
    if (!visible) return []

    const min = fixedMin ?? 0
    const max = fixedMax ?? 100
    const range = max - min
    if (range <= 0) return []

    const fmt = this.formatter ?? PriceScale.defaultFormatter
    const ticks: PriceTick[] = []

    // Estimate tick step
    const step = this._estimateTickStep(min, max)
    if (step <= 0) return []

    // Generate ticks
    let price = Math.ceil(min / step) * step
    while (price <= max) {
      const ratio = (price - min) / range
      const pixelY = inverted
        ? ratio * canvasHeight * zoomY
        : (1 - ratio) * canvasHeight * zoomY
      ticks.push({ price, label: fmt(price), pixelY })
      price += step
    }

    return ticks
  }

  /** Estimate a nice tick step for the visible price range */
  private _estimateTickStep(min: number, max: number): number {
    const range = max - min
    if (range <= 0) return 1

    // Target ~8-10 ticks
    const rawStep = range / 9

    // Round to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const normalized = rawStep / magnitude

    let niceStep: number
    if (normalized <= 1.5) niceStep = 1
    else if (normalized <= 3.5) niceStep = 2
    else if (normalized <= 7.5) niceStep = 5
    else niceStep = 10

    return niceStep * magnitude
  }
}
