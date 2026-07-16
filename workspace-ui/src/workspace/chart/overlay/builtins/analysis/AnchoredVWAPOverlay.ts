// ── AnchoredVWAPOverlay — volume-weighted average price from anchor ──
// Renders VWAP ± standard deviations starting from a user-selected anchor
// point. The anchor is set via instance data (not InteractionRuntime) —
// the calculation is performed externally and the result is stored in data.
//
// Visual elements:
//   — Vertical dashed line at the anchor time
//   — VWAP horizontal line (solid, primary)
//   — ±1σ bands (dashed)
//   — ±2σ bands (lighter, more dashed)
//
// Data shape:
//   anchorTime: number   (epoch ms — VWAP calculation start)
//   vwap: number         (current VWAP value)
//   upper1, lower1: number (±1σ)
//   upper2, lower2: number (±2σ)
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'
import { renderLine, DEFAULT_STYLE } from '../../PriceLineOverlayBase'
import type { PriceLineStyle } from '../../PriceLineOverlayBase'

interface VWAPLine {
  readonly key: string
  readonly label: string
  readonly style: Partial<PriceLineStyle>
}

const LINES: readonly VWAPLine[] = [
  { key: 'upper2', label: 'A+2σ', style: { color: '#90caf9', lineWidth: 0.5, lineDash: [2, 4], labelBg: '#90caf9', labelText: '#1a1a2e', icon: '' } },
  { key: 'upper1', label: 'A+1σ', style: { color: '#64b5f6', lineWidth: 1, lineDash: [4, 4], labelBg: '#64b5f6', labelText: '#1a1a2e', icon: '' } },
  { key: 'vwap',  label: 'AVWAP', style: { color: '#1e88e5', lineWidth: 2, lineDash: [], labelBg: '#1e88e5', labelText: '#ffffff', icon: '' } },
  { key: 'lower1', label: 'A-1σ', style: { color: '#64b5f6', lineWidth: 1, lineDash: [4, 4], labelBg: '#64b5f6', labelText: '#1a1a2e', icon: '' } },
  { key: 'lower2', label: 'A-2σ', style: { color: '#90caf9', lineWidth: 0.5, lineDash: [2, 4], labelBg: '#90caf9', labelText: '#1a1a2e', icon: '' } },
]

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  const { ctx: c, width: w, height: h } = ctx
  const anchorTime = inst.data.anchorTime as number | undefined

  c.save()

  // Anchor vertical line
  if (anchorTime != null) {
    const ax = ctx.timeToPixel(anchorTime)
    if (ax >= 0 && ax <= w) {
      c.strokeStyle = 'rgba(30, 136, 229, 0.3)'
      c.lineWidth = 1
      c.setLineDash([4, 6])
      c.beginPath()
      c.moveTo(ax, 0)
      c.lineTo(ax, h)
      c.stroke()
      c.setLineDash([])

      // Anchor dot
      const vwap = inst.data.vwap as number | undefined
      if (vwap != null) {
        const ay = ctx.priceToPixel(vwap)
        if (ay >= 0 && ay <= h) {
          c.fillStyle = '#1e88e5'
          c.beginPath()
          c.arc(ax, ay, 3, 0, Math.PI * 2)
          c.fill()
        }
      }
    }
  }

  // VWAP and band lines
  for (const line of LINES) {
    const price = inst.data[line.key] as number | undefined
    if (price == null) continue
    const y = ctx.priceToPixel(price)
    if (y < 0 || y > h) continue
    renderLine(ctx, y, { ...DEFAULT_STYLE, ...line.style }, line.label)
  }

  c.restore()
}

export const anchoredVWAPDefinition: OverlayDefinition = {
  id: 'anchored-vwap',
  name: 'Anchored VWAP',
  category: 'volume',
  render,
}
