// ── EventOverlayBase — factory for timeline event markers ──
// Provides common render + hitTest for overlays that display a timestamped
// event marker near the top of the chart. Each event type provides a
// unique config (icon, color scheme), and the factory returns a full
// OverlayDefinition.
//
// Usage:
//   export const newsDefinition = createEventOverlay({
//     id: 'news-event',
//     name: 'News Event',
//     category: 'event',
//     defaultStyle: { color: '#42a5f5', icon: '\u{1F4F0}' },
//   })
//
// Instance data shape:
//   title: string          (primary label)
//   subtitle?: string      (secondary line, e.g. 'Beat by $0.35')
//   importance?: 'low' | 'medium' | 'high'  (affects color if configured)
//
// Primary OverlayInstance.position.time = event timestamp (epoch ms).
//
// @since 3.3.8

import type { OverlayDefinition } from './OverlayDefinition'
import type { OverlayInstance } from './OverlayInstance'
import type { OverlayCategory, OverlayRenderContext } from './types'

// ── Style ──

export interface EventMarkerStyle {
  readonly color: string
  readonly icon: string
  readonly bgColor: string
  readonly textColor: string
}

const DEFAULT_STYLE: EventMarkerStyle = {
  color: '#ffa726',
  icon: '\u{26A0}\u{FE0F}', // ⚠️
  bgColor: 'rgba(30, 30, 48, 0.85)',
  textColor: '#ffffff',
}

// Importance colour overrides
const IMPORTANCE_STYLE: Record<string, Partial<EventMarkerStyle>> = {
  low: { color: '#66bb6a', icon: '' },
  medium: { color: '#ffa726', icon: '' },
  high: { color: '#ef5350', icon: '' },
}

// ── Layout constants ──

const TOP_OFFSET = 6        // y — top edge of the label
const LINE_HEIGHT = 14      // font size for title
const LABEL_GAP = 4         // gap between elements
const FLAG_HEIGHT = 28      // total height of the flag area

// ── Config ──

export interface EventOverlayConfig {
  readonly id: string
  readonly name: string
  readonly category: OverlayCategory
  readonly defaultStyle: Partial<EventMarkerStyle>
}

// ── Render helpers ──

function resolveColor(
  defaults: EventMarkerStyle,
  inst: OverlayInstance,
): string {
  // 1. Explicit color in data takes priority
  const explicitColor = inst.data.color as string | undefined
  if (explicitColor) return explicitColor

  // 2. Importance-based colour
  const importance = inst.data.importance as string | undefined
  if (importance) {
    const impStyle = IMPORTANCE_STYLE[importance]
    if (impStyle?.color) return impStyle.color
  }

  // 3. Default
  return defaults.color
}

// ── Factory ──

/**
 * Create an OverlayDefinition for a timeline event marker.
 *
 * Renders an icon + title (and optional subtitle) at the top of the chart,
 * aligned to the event timestamp on the time axis. The colour reflects
 * event importance or a custom override.
 */
export function createEventOverlay(
  config: EventOverlayConfig,
): OverlayDefinition {
  const { id, name, category, defaultStyle } = config

  const resolvedDefaults: EventMarkerStyle = { ...DEFAULT_STYLE, ...defaultStyle }

  return {
    id,
    name,
    category,

    render(
      ctx: OverlayRenderContext,
      inst: OverlayInstance,
    ): void {
      const eventTime = inst.position?.time
      if (eventTime == null) return

      const x = ctx.timeToPixel(eventTime)
      if (x < 0 || x > ctx.width) return

      const { ctx: c, width } = ctx
      const color = resolveColor(resolvedDefaults, inst)
      const icon = (inst.data.icon as string) ?? resolvedDefaults.icon
      const title = (inst.data.title as string) ?? ''
      const subtitle = inst.data.subtitle as string | undefined

      c.save()

      // ── Vertical flag line from top down ──
      c.strokeStyle = color
      c.lineWidth = 1
      c.setLineDash([2, 3])
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x, FLAG_HEIGHT)
      c.stroke()
      c.setLineDash([])

      // ── Label area ──
      // Measure the full text width for the background
      c.font = `bold ${LINE_HEIGHT}px 'Segoe UI', sans-serif`
      const titleWidth = c.measureText(title).width
      const iconWidth = icon ? c.measureText(icon).width + LABEL_GAP : 0
      const totalWidth = iconWidth + titleWidth + LABEL_GAP * 2

      // Position: render to the RIGHT of the event line if there's space,
      // otherwise to the LEFT (flip)
      const labelX = (x + LABEL_GAP + totalWidth < width)
        ? x + LABEL_GAP
        : x - LABEL_GAP - totalWidth

      // Background pill
      const pillHeight = subtitle ? FLAG_HEIGHT - 2 : LINE_HEIGHT + LABEL_GAP * 2
      c.fillStyle = DEFAULT_STYLE.bgColor
      const pillY = TOP_OFFSET
      c.beginPath()
      c.roundRect(labelX - 2, pillY, totalWidth + 4, pillHeight, 3)
      c.fill()

      // Icon
      if (icon) {
        c.fillStyle = color
        c.font = `${LINE_HEIGHT}px 'Segoe UI', sans-serif`
        c.textAlign = 'left'
        c.textBaseline = 'top'
        c.fillText(icon, labelX, pillY + LABEL_GAP)
      }

      // Title
      c.fillStyle = resolvedDefaults.textColor
      c.font = `bold ${LINE_HEIGHT}px 'Segoe UI', sans-serif`
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.fillText(title, labelX + iconWidth, pillY + LABEL_GAP)

      // Subtitle
      if (subtitle) {
        c.fillStyle = color
        c.font = `11px 'Segoe UI', sans-serif`
        c.textBaseline = 'top'
        c.fillText(subtitle, labelX + iconWidth, pillY + LINE_HEIGHT + LABEL_GAP)
      }

      c.restore()
    },

    hitTest(
      point: { x: number; y: number },
      inst: OverlayInstance,
      ctx: OverlayRenderContext,
    ): number | null {
      const eventTime = inst.position?.time
      if (eventTime == null) return null

      const x = ctx.timeToPixel(eventTime)
      // Distance to the vertical flag line
      return Math.abs(point.x - x)
    },
  }
}
