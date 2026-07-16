// ── StrategyBuilderRuntime — Graph Canvas orchestrator ──
//
// Wires canvas, viewport, interaction, selection, and renderer
// together. Single entry point for Sprint 3.6.1 foundation.
//
// @since 3.6.1

import { CanvasManager } from '../canvas/CanvasManager'
import { ViewportState } from '../viewport/ViewportState'
import { InteractionManager } from '../interaction/InteractionManager'
import { SelectionManager } from '../selection/SelectionManager'
import { Renderer } from '../rendering/Renderer'
import { BuilderEventBus } from './BuilderEventBus'

export interface StrategyBuilderOptions {
  element: HTMLElement
  width?: number
  height?: number
  initialZoom?: number
}

export class StrategyBuilderRuntime {
  readonly eventBus: BuilderEventBus
  readonly canvas: CanvasManager
  readonly viewport: ViewportState
  readonly interaction: InteractionManager
  readonly selection: SelectionManager
  readonly renderer: Renderer

  private _connected = false

  constructor(options: StrategyBuilderOptions) {
    const { element, width, height, initialZoom = 1 } = options

    this.eventBus = new BuilderEventBus()
    this.canvas = new CanvasManager(element, width, height)
    this.viewport = new ViewportState({ zoom: initialZoom })
    this.interaction = new InteractionManager(element)
    this.selection = new SelectionManager()
    this.renderer = new Renderer()
  }

  connect(): void {
    if (this._connected) return
    this._connected = true

    this.interaction.connect(this.eventBus)
    this.selection.connect(this.eventBus)
    this.renderer.connect(this.eventBus, this.viewport, this.canvas)

    this._wireInteraction()

    // Boot layers
    this.canvas.addLayer('grid', 0)
    this.canvas.addLayer('edges', 1)
    this.canvas.addLayer('nodes', 2)
    this.canvas.addLayer('selection', 3)
    this.canvas.addLayer('marquee', 4)
    this.canvas.addLayer('overlay', 5)

    this.renderer.requestFrame()
  }

  disconnect(): void {
    if (!this._connected) return
    this._connected = false
    this.interaction.disconnect()
    this.eventBus.clear()
  }

  resize(width: number, height: number): void {
    this.canvas.resize(width, height)
    this.renderer.requestFrame()
  }

  destroy(): void {
    this.disconnect()
    this.canvas.destroy()
  }

  // ── Interaction wiring ──

  private _wireInteraction(): void {
    this.interaction.registerHandler({
      onWheel: (event, delta) => {
        // Zoom toward pointer
        const factor = delta > 0 ? 0.9 : 1.1
        const newZoom = Math.min(this.viewport.maxZoom, Math.max(this.viewport.minZoom, this.viewport.zoom * factor))
        // Zoom toward cursor
        if (newZoom !== this.viewport.zoom) {
          const ratio = newZoom / this.viewport.zoom
          this.viewport.originX = event.position.x - ratio * (event.position.x - this.viewport.originX)
          this.viewport.originY = event.position.y - ratio * (event.position.y - this.viewport.originY)
          this.viewport.zoom = newZoom
          this.eventBus.emit('builder:viewport:changed', this.viewport.snapshot())
        }
      },

      onDrag: (_drag) => {
        // Pan viewport with middle button or space+drag
        // (left-button drag is handled by child handlers)
      },

      onClick: (event) => {
        // Delegate hit test to selection manager
        const graphPoint = this.viewport.screenToGraph(event.position.x, event.position.y)
        const result = this.selection.hitTest(graphPoint)
        if (result.hit) {
          this.selection.select(result.id!, event.modifiers.shift)
        } else {
          this.selection.deselectAll()
        }
      },
    })
  }
}
