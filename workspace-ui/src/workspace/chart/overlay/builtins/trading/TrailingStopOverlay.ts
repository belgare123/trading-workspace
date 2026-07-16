// ── TrailingStopOverlay — trailing stop visualisation ──
// Renders the current trailing stop level, activation level, and state.
// State is stored in OverlayInstance.data and updated by an external
// position-monitoring service — no tick/update hooks needed in the
// OverlayDefinition contract.
//
// Data shape:
//   entryPrice: number
//   activationPrice: number    (price at which trailing activates)
//   currentStop: number        (latest stop level)
//   offset: number             (trailing distance)
//   mode: 'fixed' | 'atr' | 'percent'
//   state: 'inactive' | 'activation' | 'trail' | 'stopped'
//   direction: 'long' | 'short'
//   label?: string
//
// The instance position carries the ENTRY price/time so the overlay
// appears anchored to the open position.
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'

// ── Colour tokens ──

const COLORS = {
  entry:       '#4fc3f7',
  activation:  '#26c6da',
  trail:       '#ffa726',
  stopped:     '#ef5350',
  labelBg:     'rgba(30, 30, 48, 0.8)',
  labelText:   '#ffffff',
  inactive:    '#78909c',
}

// ── State machine labels ──

const STATE_LABEL: Record<string, string> = {
  inactive:    'TRAIL INACTIVE',
  activation:  'TRAIL ACTIVE',
  trail:       'TRAILING',
  stopped:     'STOPPED',
}

// ── Render helpers ──

function renderPriceLine(
  ctx: CanvasRenderingContext2D,
  _x: number, y: number, w: number,
  color: string, lineWidth: number, dash: number[],
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(w, y)
  ctx.stroke()
  ctx.setLineDash([])
}

function renderLabel(
  ctx: CanvasRenderingContext2D,
  label: string, x: number, y: number,
  color: string,
): void {
  ctx.font = `bold 11px 'Segoe UI', sans-serif`
  const tw = ctx.measureText(label).width + 8
  const lx = Math.max(4, Math.min(x - tw / 2, x - tw > 0 ? x - tw : 4))

  ctx.fillStyle = COLORS.labelBg
  ctx.beginPath()
  ctx.roundRect(lx, y - 10, tw, 16, 3)
  ctx.fill()

  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, lx + tw / 2, y - 2)
}

// ── Definition ──

export const trailingStopDefinition: OverlayDefinition = {
  id: 'trailing-stop',
  name: 'Trailing Stop',
  category: 'custom',

  render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
    const data = inst.data as Record<string, unknown>
    const state = (data.state as string) ?? 'inactive'
    const entry = data.entryPrice as number | undefined
    const activation = data.activationPrice as number | undefined
    const stop = data.currentStop as number | undefined
    const offset = data.offset as number ?? 0
    const mode = (data.mode as string) ?? 'fixed'

    const { ctx: c, width } = ctx

    c.save()

    // 1. Entry line (always visible, faint)
    if (entry != null) {
      const ey = ctx.priceToPixel(entry)
      renderPriceLine(c, 0, ey, width, COLORS.entry, 1, [3, 5])
      renderLabel(c, `E ${entry.toFixed(2)}`, 10, ey, COLORS.entry)
    }

    // 2. Activation line (dashed, visible once activated)
    if (activation != null && (state === 'activation' || state === 'trail')) {
      const ay = ctx.priceToPixel(activation)
      renderPriceLine(c, 0, ay, width, COLORS.activation, 1, [4, 6])
      renderLabel(c, `ACT ${activation.toFixed(2)}`, width - 10, ay, COLORS.activation)
    }

    // 3. Current stop line
    if (stop != null) {
      const sy = ctx.priceToPixel(stop)
      const stopColor = state === 'stopped' ? COLORS.stopped : COLORS.trail
      const lineW = state === 'stopped' ? 2 : 1.5
      const dash: number[] = state === 'stopped' ? [] : [6, 4]
      renderPriceLine(c, 0, sy, width, stopColor, lineW, dash)

      // Stop label
      const offsetStr = mode === 'atr' ? `${offset}A` : mode === 'percent' ? `${offset}%` : `${offset}`
      const stateLabel = STATE_LABEL[state] ?? state
      const label = state === 'trail' || state === 'activation'
        ? `TS ${stop.toFixed(2)} (${offsetStr})`
        : state === 'stopped'
          ? `STOPPED @ ${stop.toFixed(2)}`
          : `TS ${stop.toFixed(2)}`

      renderLabel(c, label, width / 2, sy, stopColor)

      // State badge at top-right
      if (state !== 'inactive') {
        c.font = `bold 10px 'Segoe UI', sans-serif`
        const badgeW = c.measureText(stateLabel).width + 10
        c.fillStyle = stopColor
        c.beginPath()
        c.roundRect(width - badgeW - 4, 4, badgeW, 16, 3)
        c.fill()
        c.fillStyle = '#ffffff'
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText(stateLabel, width - badgeW / 2 - 4, 12)
      }
    }

    // 4. Inactive — show only offset info near entry
    if (state === 'inactive' && entry != null && offset > 0) {
      const label = mode === 'atr'
        ? `Trail: ${offset}A`
        : mode === 'percent'
          ? `Trail: ${offset}%`
          : `Trail: ${offset}`
      c.font = `10px 'Segoe UI', sans-serif`
      c.fillStyle = COLORS.inactive
      c.textAlign = 'right'
      c.textBaseline = 'top'
      c.fillText(label, width - 4, 4)
    }

    c.restore()
  },

  hitTest(
    point: { x: number; y: number },
    inst: OverlayInstance,
    ctx: OverlayRenderContext,
  ): number | null {
    const data = inst.data as Record<string, unknown>
    const stop = data.currentStop as number | undefined
    const entry = data.entryPrice as number | undefined
    const HIT_THRESHOLD = 8

    // Hit-test against entry and stop lines (horizontal)
    for (const price of [entry, stop]) {
      if (price == null) continue
      const py = ctx.priceToPixel(price)
      const dy = Math.abs(point.y - py)
      if (dy < HIT_THRESHOLD) return dy
    }

    return null
  },
}
