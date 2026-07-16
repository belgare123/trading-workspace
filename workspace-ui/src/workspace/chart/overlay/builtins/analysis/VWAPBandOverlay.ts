// ── VWAPBandOverlay — VWAP ± standard deviation bands ──
// Renders VWAP central line plus two upper/lower standard deviation bands.
// All bands share the same colour but use line dash and opacity to
// distinguish levels.
//
// Data shape:
//   vwap: number
//   upper1: number  (VWAP + 1σ)
//   lower1: number  (VWAP - 1σ)
//   upper2: number  (VWAP + 2σ)
//   lower2: number  (VWAP - 2σ)
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'
import { renderLine, DEFAULT_STYLE } from '../../PriceLineOverlayBase'
import type { PriceLineStyle } from '../../PriceLineOverlayBase'

interface VWAPBandHandle {
  readonly key: string
  readonly label: string
  readonly style: Partial<PriceLineStyle>
}

const HANDLES: readonly VWAPBandHandle[] = [
  { key: 'upper2', label: '+2σ', style: { color: '#90caf9', lineWidth: 0.5, lineDash: [2, 4], labelBg: '#90caf9', labelText: '#1a1a2e', icon: '' } },
  { key: 'upper1', label: '+1σ', style: { color: '#64b5f6', lineWidth: 1, lineDash: [4, 4], labelBg: '#64b5f6', labelText: '#1a1a2e', icon: '' } },
  { key: 'vwap',  label: 'VWAP', style: { color: '#42a5f5', lineWidth: 1.5, lineDash: [], labelBg: '#42a5f5', labelText: '#ffffff', icon: '' } },
  { key: 'lower1', label: '-1σ', style: { color: '#64b5f6', lineWidth: 1, lineDash: [4, 4], labelBg: '#64b5f6', labelText: '#1a1a2e', icon: '' } },
  { key: 'lower2', label: '-2σ', style: { color: '#90caf9', lineWidth: 0.5, lineDash: [2, 4], labelBg: '#90caf9', labelText: '#1a1a2e', icon: '' } },
]

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  ctx.ctx.save()
  for (const h of HANDLES) {
    const price = inst.data[h.key] as number | undefined
    if (price == null) continue
    const y = ctx.priceToPixel(price)
    if (y < 0 || y > ctx.height) continue
    renderLine(ctx, y, { ...DEFAULT_STYLE, ...h.style }, h.label)
  }
  ctx.ctx.restore()
}

export const vwapBandDefinition: OverlayDefinition = {
  id: 'vwap-band',
  name: 'VWAP Bands',
  category: 'volume',
  render,
}
