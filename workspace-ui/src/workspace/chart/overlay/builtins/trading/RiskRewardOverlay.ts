// ── RiskRewardOverlay — trade risk/reward geometry ──
// Renders Entry, Stop, Target lines with filled risk and reward zones,
// plus a computed R:R ratio label. The overlay is display-only in v1.0
// but exposes hit-testable handles at stop and target positions for
// future interactive editing.
//
// Data shape:
//   entryPrice: number
//   targetPrice: number
//   stopPrice: number
//   direction: 'long' | 'short'
//   label?: string
//
// The instance position carries the entry price/time.
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'

// ── Internal handle descriptors (for hit-test) ──

interface RRHandle {
  readonly kind: 'entry' | 'stop' | 'target'
  readonly price: number
}

// ── Colour tokens ──

const COLORS = {
  entry:     '#4fc3f7',
  stop:      '#ef5350',
  target:    '#66bb6a',
  riskFill:  'rgba(239, 83, 80, 0.12)',
  rewardFill:'rgba(102, 187, 106, 0.12)',
  labelBg:   'rgba(30, 30, 48, 0.85)',
  labelText: '#ffffff',
  muted:     '#546e7a',
}

const HANDLE_SIZE = 6   // px radius of handle circles

// ── Render helpers ──

function renderLine(
  c: CanvasRenderingContext2D,
  y: number, w: number,
  color: string, lineWidth: number, dash: number[],
  label: string, labelX: number,
): void {
  // Horizontal line
  c.strokeStyle = color
  c.lineWidth = lineWidth
  c.setLineDash(dash)
  c.beginPath()
  c.moveTo(0, y)
  c.lineTo(w, y)
  c.stroke()
  c.setLineDash([])

  // Label pill
  c.font = `bold 11px 'Segoe UI', sans-serif`
  const tw = c.measureText(label).width + 8
  const lx = Math.max(4, Math.min(labelX - tw / 2, w - tw - 4))
  c.fillStyle = COLORS.labelBg
  c.beginPath()
  c.roundRect(lx, y - 10, tw, 16, 3)
  c.fill()
  c.fillStyle = color
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, lx + tw / 2, y - 2)
}

function renderZone(
  c: CanvasRenderingContext2D,
  yTop: number, yBottom: number, w: number,
  color: string, label: string,
): void {
  const h = yBottom - yTop
  if (h <= 1) return

  c.fillStyle = color
  c.fillRect(0, yTop, w, h)

  // Zone label
  c.font = `bold 10px 'Segoe UI', sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const cx = w / 2
  const cy = yTop + h / 2
  const tw = c.measureText(label).width + 12
  const th = 18
  c.fillStyle = COLORS.labelBg
  c.beginPath()
  c.roundRect(cx - tw / 2, cy - th / 2, tw, th, 3)
  c.fill()
  c.fillStyle = color
  c.fillText(label, cx, cy + 1)
}

function renderHandle(
  c: CanvasRenderingContext2D,
  x: number, y: number,
  color: string,
): void {
  c.strokeStyle = color
  c.lineWidth = 2
  c.beginPath()
  c.arc(x, y, HANDLE_SIZE, 0, Math.PI * 2)
  c.stroke()
  c.fillStyle = COLORS.labelBg
  c.fill()
}

// ── Definition ──

export const riskRewardDefinition: OverlayDefinition = {
  id: 'risk-reward',
  name: 'Risk/Reward',
  category: 'custom',

  render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
    const data = inst.data as Record<string, unknown>
    const entry = data.entryPrice as number | undefined
    const stop = data.stopPrice as number | undefined
    const target = data.targetPrice as number | undefined
    const direction = (data.direction as string) ?? 'long'

    if (entry == null || stop == null || target == null) return

    const { ctx: c, width } = ctx
    c.save()

    // Pixel positions
    const ey = ctx.priceToPixel(entry)
    const sy = ctx.priceToPixel(stop)
    const ty = ctx.priceToPixel(target)

    // ── Zone rectangles ──
    // For long: stop is below entry, target is above entry
    // For short: stop is above entry, target is below entry
    const riskTop = Math.min(ey, sy)
    const riskBot = Math.max(ey, sy)
    const rewardTop = Math.min(ey, ty)
    const rewardBot = Math.max(ey, ty)

    renderZone(c, rewardTop, rewardBot, width, COLORS.rewardFill, 'REWARD')
    renderZone(c, riskTop, riskBot, width, COLORS.riskFill, 'RISK')

    // ── Boundary lines ──
    renderLine(c, sy, width, COLORS.stop, 1.5, [4, 4], `S ${stop.toFixed(2)}`, 30)
    renderLine(c, ey, width, COLORS.entry, 2, [], `E ${entry.toFixed(2)}`, width / 2)
    renderLine(c, ty, width, COLORS.target, 1.5, [4, 4], `T ${target.toFixed(2)}`, width - 30)

    // ── Handle indicators (visual only in v1.0) ──
    renderHandle(c, width - 16, sy, COLORS.stop)
    renderHandle(c, width - 16, ty, COLORS.target)
    renderHandle(c, 16, ey, COLORS.entry)

    // ── R:R label ──
    const riskAmount = Math.abs(entry - stop)
    const rewardAmount = Math.abs(target - entry)
    const ratio = riskAmount > 0 ? (rewardAmount / riskAmount) : 0
    const rrLabel = `R:R 1:${ratio.toFixed(1)}`

    c.font = `bold 12px 'Segoe UI', sans-serif`
    const rrW = c.measureText(rrLabel).width + 12
    const rrX = width / 2 - rrW / 2
    const rrY = Math.min(ey, sy, ty) - 20
    if (rrY > 10) {
      c.fillStyle = COLORS.labelBg
      c.beginPath()
      c.roundRect(rrX, rrY - 9, rrW, 18, 4)
      c.fill()
      c.fillStyle = ratio >= 2 ? COLORS.target : ratio >= 1 ? '#ffa726' : COLORS.stop
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(rrLabel, width / 2, rrY)
    }

    // Direction arrow mini-indicator
    const arrowY = direction === 'long'
      ? Math.max(ey, ty) + 14
      : Math.min(ey, sy) - 14
    if (arrowY > 4 && arrowY < ctx.height - 4) {
      c.fillStyle = COLORS.muted
      c.font = '10px sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(direction === 'long' ? '\u2191 LONG' : '\u2193 SHORT', width / 2, arrowY)
    }

    c.restore()
  },

  hitTest(
    point: { x: number; y: number },
    inst: OverlayInstance,
    ctx: OverlayRenderContext,
  ): number | null {
    const data = inst.data as Record<string, unknown>
    const entry = data.entryPrice as number | undefined
    const stop = data.stopPrice as number | undefined
    const target = data.targetPrice as number | undefined
    const HIT_THRESHOLD = 10

    // Build internal handles
    const handles: RRHandle[] = []
    if (entry != null) handles.push({ kind: 'entry', price: entry })
    if (stop != null) handles.push({ kind: 'stop', price: stop })
    if (target != null) handles.push({ kind: 'target', price: target })

    for (const h of handles) {
      const py = ctx.priceToPixel(h.price)
      const dy = Math.abs(point.y - py)
      if (dy < HIT_THRESHOLD) return dy
    }

    return null
  },
}
