// ── Fibonacci Retracement ──
// Horizontal levels at key Fibonacci ratios between two price anchors.
// Levels: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%

import type { DrawingDefinition, DrawingRenderContext } from '../DrawingDefinition'
import { DrawingInstance } from '../DrawingInstance'
import { distanceToLineSegment } from '../../interaction/hitTestUtils'

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const HOUR_SECONDS = 3600
const DEFAULT_OFFSET = 5 * HOUR_SECONDS

export const FibonacciDefinition: DrawingDefinition = {
  id: 'fib-retracement',
  name: 'Fibonacci Retracement',
  category: 'fibonacci',
  defaultStyle: {
    lineColor: '#8B5CF6',
    lineWidth: 1,
    lineStyle: 'solid',
    fillColor: 'rgba(139, 92, 246, 0.08)',
  },
  create(anchor): DrawingInstance {
    const inst = new DrawingInstance(
      'fib-retracement',
      [
        { time: anchor.time, price: anchor.price },
        { time: anchor.time + DEFAULT_OFFSET, price: anchor.price + 200 },
      ],
      { ...FibonacciDefinition.defaultStyle },
    )
    inst.metadata = {
      levels: FIB_LEVELS,
      extendRight: true,
    }
    return inst
  },
  render(ctx: DrawingRenderContext, inst: DrawingInstance): void {
    if (inst.anchors.length < 2) return

    const priceHigh = Math.max(inst.anchors[0].price, inst.anchors[1].price)
    const priceLow = Math.min(inst.anchors[0].price, inst.anchors[1].price)
    const range = priceHigh - priceLow
    if (range === 0) return

    // Always extend to the full visible width
    const drawLeft = 0
    const drawRight = ctx.width

    const levels = (inst.metadata?.levels as number[]) ?? FIB_LEVELS

    for (let i = 0; i < levels.length; i++) {
      const ratio = levels[i]
      const price = priceHigh - ratio * range
      const y = ctx.priceToPixel(price)

      // Color gradient: extreme levels brighter
      const isExtreme = i === 0 || i === levels.length - 1
      ctx.ctx.strokeStyle = isExtreme
        ? inst.style.lineColor ?? '#8B5CF6'
        : `${inst.style.lineColor ?? '#8B5CF6'}80`
      ctx.ctx.lineWidth = isExtreme ? (inst.style.lineWidth ?? 1) + 1 : inst.style.lineWidth ?? 1

      if (inst.style.lineStyle === 'dashed') ctx.ctx.setLineDash([6, 3])
      else if (inst.style.lineStyle === 'dotted') ctx.ctx.setLineDash([2, 2])
      else ctx.ctx.setLineDash([])

      ctx.ctx.beginPath()
      ctx.ctx.moveTo(drawLeft, y)
      ctx.ctx.lineTo(drawRight, y)
      ctx.ctx.stroke()

      // Level label on the right edge
      ctx.ctx.fillStyle = ctx.ctx.strokeStyle
      ctx.ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.ctx.textAlign = 'right'
      ctx.ctx.textBaseline = 'middle'
      ctx.ctx.fillText(`${(ratio * 100).toFixed(1)}% (${price.toFixed(2)})`, drawRight - 8, y - 10)
    }

    // Semi-transparent fill between levels
    if (inst.style.fillColor) {
      for (let i = 0; i < levels.length - 1; i++) {
        const yTop = ctx.priceToPixel(priceHigh - levels[i] * range)
        const yBottom = ctx.priceToPixel(priceHigh - levels[i + 1] * range)
        ctx.ctx.fillStyle = inst.style.fillColor
        ctx.ctx.fillRect(drawLeft, yTop, drawRight - drawLeft, yBottom - yTop)
      }
    }
  },
  hitTest(point, inst, context): number | null {
    if (inst.anchors.length < 2) return null
    const x1 = context.timeToPixel(inst.anchors[0].time)
    const y1 = context.priceToPixel(inst.anchors[0].price)
    const x2 = context.timeToPixel(inst.anchors[1].time)
    const y2 = context.priceToPixel(inst.anchors[1].price)
    // Hit-test against the baseline (line connecting the two anchors)
    return distanceToLineSegment(point.x, point.y, x1, y1, x2, y2)
  },
}
