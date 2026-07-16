// ── PriceLineOverlayBase — factory for horizontal price-line overlays ──
// Provides common render + hitTest for overlays that display a horizontal
// line at a specific price level with a label on the right edge.
//
// Each overlay type provides a unique config; the factory returns a full
// OverlayDefinition with consistent rendering and interaction behaviour.
//
// Usage:
//   export const stopLossDefinition = createPriceLineOverlay({
//     id: 'stop-loss',
//     name: 'Stop Loss',
//     category: 'trade',
//     defaultStyle: { color: '#ef5350', lineDash: [4, 4], labelBg: '#ef5350' },
//   })
//
// @since 3.3.8

import type { OverlayDefinition } from './OverlayDefinition'
import type { OverlayInstance } from './OverlayInstance'
import type { OverlayCategory, OverlayRenderContext } from './types'

// ── Style ──

export interface PriceLineStyle {
  readonly color: string
  readonly lineWidth: number
  readonly lineDash: readonly number[]
  readonly labelBg: string
  readonly labelText: string
  readonly icon: string
}

export const DEFAULT_STYLE: PriceLineStyle = {
  color: '#ffd54f',
  lineWidth: 1,
  lineDash: [4, 4],
  labelBg: '#ffd54f',
  labelText: '#1a1a2e',
  icon: '',
}

// ── Config ──

export interface PriceLineOverlayConfig {
  readonly id: string
  readonly name: string
  readonly category: OverlayCategory
  readonly defaultStyle: Partial<PriceLineStyle>
}

// ── Render helpers ──

/** Resolve effective style: config defaults merged with per-instance overrides. */
export function resolveStyle(
  defaults: Partial<PriceLineStyle>,
  inst: OverlayInstance,
): PriceLineStyle {
  const overrides = inst.data.style as Partial<PriceLineStyle> | undefined
  return { ...DEFAULT_STYLE, ...defaults, ...overrides }
}

/** Render a horizontal line + right-edge label. */
export function renderLine(
  ctx: OverlayRenderContext,
  y: number,
  style: PriceLineStyle,
  label: string,
): void {
  const { ctx: c, width } = ctx
  const padding = 4

  // Horizontal line
  c.strokeStyle = style.color
  c.lineWidth = style.lineWidth
  if (style.lineDash.length > 0) c.setLineDash([...style.lineDash])
  c.beginPath()
  c.moveTo(0, y)
  c.lineTo(width, y)
  c.stroke()
  c.setLineDash([])

  // Icon before label (if any)
  let labelPrefix = ''
  if (style.icon) {
    labelPrefix = `${style.icon} `
  }
  const fullLabel = `${labelPrefix}${label}`

  // Label background on the right edge
  c.font = `11px 'Segoe UI', sans-serif`
  c.textAlign = 'right'
  c.textBaseline = 'middle'
  const textWidth = c.measureText(fullLabel).width + padding * 2

  c.fillStyle = style.labelBg
  c.fillRect(width - textWidth, y - 9, textWidth, 18)

  // Label text
  c.fillStyle = style.labelText
  c.fillText(fullLabel, width - padding, y)
}

// ── Factory ──

/**
 * Create an OverlayDefinition for a horizontal price-line overlay.
 *
 * Responsibilities (all encapsulated):
 * - Render: horizontal line at position.price + right-edge label
 * - Hit-test: pixel distance to the horizontal line
 * - Style: defaults from config, overridable per-instance via data.style
 */
export function createPriceLineOverlay(
  config: PriceLineOverlayConfig,
): OverlayDefinition {
  const { id, name, category, defaultStyle } = config

  return {
    id,
    name,
    category,

    render(
      ctx: OverlayRenderContext,
      inst: OverlayInstance,
    ): void {
      const price = inst.position?.price
      if (price == null) return

      const y = ctx.priceToPixel(price)
      if (y < 0 || y > ctx.height) return

      const style = resolveStyle(defaultStyle, inst)
      const label = (inst.data.label as string) ?? price.toFixed(2)

      ctx.ctx.save()
      renderLine(ctx, y, style, label)
      ctx.ctx.restore()
    },

    hitTest(
      point: { x: number; y: number },
      inst: OverlayInstance,
      ctx: OverlayRenderContext,
    ): number | null {
      const price = inst.position?.price
      if (price == null) return null

      const y = ctx.priceToPixel(price)
      return Math.abs(point.y - y)
    },
  }
}
