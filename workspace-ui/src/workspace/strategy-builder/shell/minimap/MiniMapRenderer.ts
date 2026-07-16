// ── MiniMapRenderer — Canvas minimap renderer ──
//
// Renders the minimap state onto a 2D canvas.
// Uses scaled transform — same nodes/edges, just smaller.
//
// @since 3.6.4

import type { MiniMapState } from './MiniMapRuntime'

export class MiniMapRenderer {
  /** Render minimap state to a canvas context */
  render(ctx: CanvasRenderingContext2D, state: MiniMapState, width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1
    ctx.save()

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width * dpr, height * dpr)

    if (!state.bounds || state.nodes.length === 0) {
      ctx.fillStyle = '#666'
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('empty', width * dpr / 2, height * dpr / 2)
      ctx.restore()
      return
    }

    // Scale to device pixels
    ctx.scale(dpr, dpr)

    // Draw edges (simplified lines)
    ctx.strokeStyle = 'rgba(100, 140, 255, 0.3)'
    ctx.lineWidth = 0.5
    for (const edge of state.edges) {
      ctx.beginPath()
      ctx.moveTo(edge.sx, edge.sy)
      ctx.lineTo(edge.tx, edge.ty)
      ctx.stroke()
    }

    // Draw nodes
    for (const node of state.nodes) {
      // Background
      ctx.fillStyle = node.selected ? '#4a7cff' : '#2a2a4a'
      ctx.fillRect(node.x, node.y, node.width, node.height)

      // Border
      ctx.strokeStyle = node.selected ? '#6a9cff' : '#444'
      ctx.lineWidth = node.selected ? 1 : 0.5
      ctx.strokeRect(node.x, node.y, node.width, node.height)

      // Label (truncated)
      if (node.width > 20) {
        ctx.fillStyle = '#ccc'
        ctx.font = '7px monospace'
        const label = node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label
        ctx.fillText(label, node.x + 2, node.y + node.height - 2)
      }
    }

    // Draw viewport rectangle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.strokeRect(
      state.viewport.x * state.scale + (state.bounds.x * state.scale) + this._padding(state),
      state.viewport.y * state.scale + (state.bounds.y * state.scale) + this._padding(state),
      state.viewport.width * state.scale,
      state.viewport.height * state.scale,
    )

    ctx.restore()
  }

  private _padding(_state: MiniMapState): number {
    return 8
  }
}
