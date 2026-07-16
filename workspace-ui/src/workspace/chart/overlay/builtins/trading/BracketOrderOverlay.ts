// ── BracketOrderOverlay — composite bracket order (entry + stop + target) ──
// Represents a complete bracket order as a SINGLE OverlayDefinition.
// Internally manages three independent horizontal handles (entry, stop, target),
// each with its own price, style, and hit-test zone.
//
// For OverlayRuntime this is a single OverlayInstance — no special cases,
// no changes to any runtime infrastructure.
//
// Data shape (OverlayInstance.data):
//   stopPrice: number
//   targetPrice: number
//   entryLabel?: string
//   stopLabel?: string
//   targetLabel?: string
//
// Primary OverlayInstance.position.price = entry price.
//
// @since 3.3.8

import type { OverlayDefinition } from '../../OverlayDefinition'
import type { OverlayInstance } from '../../OverlayInstance'
import type { OverlayRenderContext } from '../../types'
import { renderLine, DEFAULT_STYLE } from '../../PriceLineOverlayBase'
import type { PriceLineStyle } from '../../PriceLineOverlayBase'

// ── Handle model (internal to this overlay) ──

type HandleKind = 'entry' | 'stop' | 'target'

interface BracketHandle {
  readonly id: HandleKind
  /** Label shown on the line */
  readonly label: string
  /** Style for the horizontal line */
  readonly style: Partial<PriceLineStyle>
  /** Whether this handle can be dragged */
  readonly draggable: boolean
}

// ── Handle definitions ──

const HANDLES: readonly BracketHandle[] = [
  {
    id: 'entry',
    label: 'ENTRY',
    style: {
      color: '#42a5f5',
      lineWidth: 1.5,
      lineDash: [],
      labelBg: '#42a5f5',
      labelText: '#ffffff',
      icon: '\u{1F4CD}', // 📍
    },
    draggable: true,
  },
  {
    id: 'stop',
    label: 'SL',
    style: {
      color: '#ef5350',
      lineWidth: 1.5,
      lineDash: [4, 4],
      labelBg: '#ef5350',
      labelText: '#ffffff',
      icon: '\u{1F6D1}', // 🛑
    },
    draggable: true,
  },
  {
    id: 'target',
    label: 'TP',
    style: {
      color: '#26a69a',
      lineWidth: 1.5,
      lineDash: [4, 4],
      labelBg: '#26a69a',
      labelText: '#ffffff',
      icon: '\u{1F3AF}', // 🎯
    },
    draggable: true,
  },
]

// ── Helpers ──

/** Get the price for a given handle from instance data. */
function handlePrice(handle: BracketHandle, inst: OverlayInstance): number | null {
  if (handle.id === 'entry') return inst.position?.price ?? null
  if (handle.id === 'stop') return (inst.data.stopPrice as number | undefined) ?? null
  if (handle.id === 'target') return (inst.data.targetPrice as number | undefined) ?? null
  return null
}

/** Get the override label from instance data. */
function handleLabel(handle: BracketHandle, inst: OverlayInstance): string {
  const overrideKey = `${handle.id}Label` as keyof OverlayInstance['data']
  const override = inst.data[overrideKey] as string | undefined
  return override ?? handle.label
}

/** Resolve effective style for a handle. */
function handleStyle(handle: BracketHandle): PriceLineStyle {
  return { ...DEFAULT_STYLE, ...handle.style }
}

// ── Render ──

function render(ctx: OverlayRenderContext, inst: OverlayInstance): void {
  if (!inst.position?.price) return

  ctx.ctx.save()

  for (const handle of HANDLES) {
    const price = handlePrice(handle, inst)
    if (price == null) continue

    const y = ctx.priceToPixel(price)
    if (y < 0 || y > ctx.height) continue

    const style = handleStyle(handle)
    const label = handleLabel(handle, inst)
    renderLine(ctx, y, style, label)
  }

  ctx.ctx.restore()
}

// ── Hit test ──
// Returns the minimum pixel distance to any of the three handles.
// Handle identity is NOT encoded in the return value (number) —
// a future InteractionRuntime that calls overlay hitTest can resolve
// which handle was hit by re-evaluating proximity to each handle line.

function hitTest(
  point: { x: number; y: number },
  inst: OverlayInstance,
  ctx: OverlayRenderContext,
): number | null {
  let minDistance: number | null = null

  for (const handle of HANDLES) {
    const price = handlePrice(handle, inst)
    if (price == null) continue

    const y = ctx.priceToPixel(price)
    const dist = Math.abs(point.y - y)

    if (minDistance === null || dist < minDistance) {
      minDistance = dist
    }
  }

  return minDistance
}

// ── Definition ──

export const bracketOrderDefinition: OverlayDefinition = {
  id: 'bracket-order',
  name: 'Bracket Order',
  category: 'trade',

  render,
  hitTest,
}
