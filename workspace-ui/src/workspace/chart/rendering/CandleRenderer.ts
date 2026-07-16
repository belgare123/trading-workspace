/**
 * CandleRenderer.ts — OHLCV candlestick renderer
 *
 * Renders candlesticks on the chart canvas using data from the render context.
 * Supports:
 *   - Bullish (green) / bearish (red) candles
 *   - Wick (shadow) and body rendering
 *   - Visible-range filtering (only renders on-screen candles)
 *   - Candle width auto-sizing based on visible range
 *
 * Rendered in the 'candles' layer, between grid and indicators.
 *
 * @since 3.3.2
 */

import { CanvasLayer } from './CanvasLayer'
import type { IRenderContext } from './types'
import type { OHLCV } from '../types'

export interface CandleStyle {
  /** Bullish candle body color */
  bullishColor: string
  /** Bearish candle body color */
  bearishColor: string
  /** Bullish candle wick color */
  bullishWickColor: string
  /** Bearish candle wick color */
  bearishWickColor: string
  /** Body fill opacity */
  bodyAlpha: number
  /** Wick width in pixels */
  wickWidth: number
  /** Gap between candles as a fraction of candle width (0–1) */
  gapRatio: number
  /** Minimum candle width in pixels (even when zoomed far out) */
  minCandleWidth: number
  /** Maximum candle width in pixels (even when zoomed far in) */
  maxCandleWidth: number
}

const DEFAULT_STYLE: CandleStyle = {
  bullishColor: '#26a69a',
  bearishColor: '#ef5350',
  bullishWickColor: '#26a69a',
  bearishWickColor: '#ef5350',
  bodyAlpha: 1.0,
  wickWidth: 1,
  gapRatio: 0.2,
  minCandleWidth: 2,
  maxCandleWidth: 20,
}

export class CandleRenderer extends CanvasLayer {
  readonly id = 'candles'

  style: CandleStyle

  /** Optional override: data to render (if not provided, uses context.visibleData) */
  data?: OHLCV[]

  constructor(style?: Partial<CandleStyle>) {
    super()
    this.style = { ...DEFAULT_STYLE, ...style }
  }

  render(context: IRenderContext): void {
    const ctx = context.ctx

    const ohlcv = this.data ?? context.visibleData
    if (!ohlcv || ohlcv.length === 0) return

    const { viewport } = context
    const { from, to } = viewport.timeScale
    const timeRange = to - from
    if (timeRange <= 0) return

    const { zoomX } = viewport.viewport
    const { offsetX } = viewport.viewport
    const effectiveWidth = context.width / context.dpr

    // ── Candle width calculation ──
    // Visible data count determines candle width
    const visibleCount = Math.max(1, timeRange / this._averageInterval(ohlcv))
    let candleWidth = (effectiveWidth * zoomX) / visibleCount
    candleWidth = Math.max(this.style.minCandleWidth, Math.min(this.style.maxCandleWidth, candleWidth))

    const bodyWidth = candleWidth * (1 - this.style.gapRatio)
    const halfBody = bodyWidth / 2

    // ── Render each candle ──
    for (const ohlc of ohlcv) {
      const { timestamp, open, high, low, close, volume: _ } = ohlc

      // Skip candles outside visible range
      if (timestamp < from || timestamp > to) continue

      // Convert to pixel coordinates
      const x = viewport.timeToPixel(timestamp) + offsetX
      const yOpen = viewport.priceToPixel(open)
      const yClose = viewport.priceToPixel(close)
      const yHigh = viewport.priceToPixel(high)
      const yLow = viewport.priceToPixel(low)

      // Skip if off-screen (with padding)
      if (x + halfBody < -50 || x - halfBody > effectiveWidth + 50) continue

      const isBullish = close >= open
      const bodyTop = isBullish ? yClose : yOpen
      const bodyBottom = isBullish ? yOpen : yClose
      const bodyHeight = Math.max(1, bodyBottom - bodyTop)

      const bodyColor = isBullish ? this.style.bullishColor : this.style.bearishColor
      const wickColor = isBullish ? this.style.bullishWickColor : this.style.bearishWickColor

      // ── Wick (shadow) ──
      ctx.strokeStyle = wickColor
      ctx.lineWidth = this.style.wickWidth
      ctx.beginPath()
      ctx.moveTo(x, yHigh)
      ctx.lineTo(x, bodyTop)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, bodyBottom)
      ctx.lineTo(x, yLow)
      ctx.stroke()

      // ── Body ──
      if (isBullish) {
        // Bullish: filled body
        ctx.fillStyle = bodyColor
        ctx.fillRect(x - halfBody, bodyTop, bodyWidth, bodyHeight)
      } else {
        // Bearish: filled body
        ctx.fillStyle = bodyColor
        ctx.fillRect(x - halfBody, bodyTop, bodyWidth, bodyHeight)
      }

      // ── Body outline (for visibility when many candles) ──
      ctx.strokeStyle = wickColor
      ctx.lineWidth = 0.5
      ctx.strokeRect(x - halfBody, bodyTop, bodyWidth, bodyHeight)
    }
  }

  /** Estimate average time interval between candles */
  private _averageInterval(data: OHLCV[]): number {
    if (data.length < 2) return 60_000 // default 1m
    let total = 0
    let count = 0
    for (let i = 1; i < data.length; i++) {
      total += data[i].timestamp - data[i - 1].timestamp
      count++
    }
    return count > 0 ? total / count : 60_000
  }
}
