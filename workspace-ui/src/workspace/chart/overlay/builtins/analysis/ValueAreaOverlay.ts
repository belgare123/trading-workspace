// ── ValueAreaOverlay — VAH / VAL / POC market profile lines ──
// Displays three horizontal lines representing the Value Area High,
// Value Area Low, and Point of Control from Market Profile / Volume Profile.
//
// Data shape:
//   vah: number (Value Area High)
//   val: number (Value Area Low)
//   poc: number (Point of Control)
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'
import { renderLine, DEFAULT_STYLE } from '../../PriceLineOverlayBase'
import type { PriceLineStyle } from '../../PriceLineOverlayBase'

interface ValueAreaHandle {
  readonly key: 'vah' | 'val' | 'poc'
  readonly label: string
  readonly style: Partial<PriceLineStyle>
}

const HANDLES: readonly ValueAreaHandle[] = [
  {
    key: 'vah',
    label: 'VAH',
    style: { color: '#ef9a9a', lineWidth: 1, lineDash: [4, 4], labelBg: '#ef9a9a', labelText: '#1a1a2e', icon: '' },
  },
  {
    key: 'poc',
    label: 'POC',
    style: { color: '#ffd54f', lineWidth: 2, lineDash: [], labelBg: '#ffd54f', labelText: '#1a1a2e', icon: '' },
  },
  {
    key: 'val',
    label: 'VAL',
    style: { color: '#ef9a9a', lineWidth: 1, lineDash: [4, 4], labelBg: '#ef9a9a', labelText: '#1a1a2e', icon: '' },
  },
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

export const valueAreaDefinition: OverlayDefinition = {
  id: 'value-area',
  name: 'Value Area',
  category: 'volume',
  render,
}
