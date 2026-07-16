// ── NodeRenderer — Multi-layer node rendering pipeline ──
//
// Composes node visualisation layers:
//   background → header → ports → body → status badges → selection → hover
//
// Renders ALL visible nodes in a single pass.
//
// @since 3.6.2

import type { LayerRenderer } from '../rendering/Renderer'
import type { ViewportState } from '../viewport/ViewportState'
import type { RenderFrame } from '../types'
import { NodeRegistry } from './NodeRegistry'
import type { NodeRuntime } from './NodeRuntime'

export class NodeRenderer implements LayerRenderer {
  readonly layerId = 'nodes'

  private _runtime: NodeRuntime | null = null
  private _registry: NodeRegistry
  private _dpr: number = 1

  constructor(registry?: NodeRegistry) {
    this._registry = registry ?? NodeRegistry.getInstance()
  }

  connect(runtime: NodeRuntime): void {
    this._runtime = runtime
  }

  setDPR(dpr: number): void {
    this._dpr = dpr
  }

  render(ctx: CanvasRenderingContext2D, _viewport: ViewportState, _frame: RenderFrame): void {
    if (!this._runtime) return

    const models = this._runtime.getViewModels()

    // Sort by zIndex ascending
    const sorted = [...models].sort((a, b) => a.zIndex - b.zIndex)

    for (const node of sorted) {
      const def = this._registry.get(node.id)
      if (!def) continue

      const inst = this._runtime.get(node.id)
      if (!inst) continue

      def.render({
        ctx,
        node,
        selected: inst.selected,
        hovered: inst.hovered,
        dragging: inst.dragOffset !== null,
        dpr: this._dpr,
      })
    }
  }
}
