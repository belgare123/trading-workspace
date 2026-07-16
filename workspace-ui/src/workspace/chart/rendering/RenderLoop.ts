/**
 * RenderLoop.ts — requestAnimationFrame render loop
 *
 * Orchestrates all IRenderLayer instances in a fixed order.
 * Each frame: clear → render each layer in z-order → notify.
 *
 * The loop runs while at least one layer is active.
 * It automatically pauses when the tab is hidden (via visibility API).
 *
 * @since 3.3.2
 */

import type { IRenderLayer, IRenderContext, IRenderPass } from './types'

export type FrameCallback = (timestamp: number) => void

/**
 * RenderLoop — requestAnimationFrame-based render orchestrator
 *
 * Manages a set of render layers and runs them in z-order each frame.
 * Pauses when the page is hidden, resumes when visible.
 */
export class RenderLoop {
  /** Ordered render layers (keyed by id) */
  private readonly _layers = new Map<string, IRenderLayer>()

  /** Render passes — each pass defines a z-order of layers */
  private readonly _passes: IRenderPass[] = []

  /** Current render context (updated per frame) */
  private _context: IRenderContext | null = null

  /** RAF handle (null = paused/stopped) */
  private _rafId: number | null = null

  /** Whether the loop is running */
  private _running = false

  /** External frame callback (fired after all layers rendered) */
  onFrame: FrameCallback | undefined

  /** Frame counter (for debugging) */
  frameCount = 0

  constructor(passes?: IRenderPass[]) {
    if (passes) this._passes.push(...passes)

    // Pause when tab hidden
    document.addEventListener('visibilitychange', this._onVisibilityChange)
  }

  // ── Layer management ──

  /** Register a render layer */
  addLayer(layer: IRenderLayer): void {
    this._layers.set(layer.id, layer)
  }

  /** Remove a render layer */
  removeLayer(id: string): void {
    this._layers.delete(id)
  }

  /** Get a registered layer by id */
  getLayer(id: string): IRenderLayer | undefined {
    return this._layers.get(id)
  }

  /** Add a render pass */
  addPass(pass: IRenderPass): void {
    this._passes.push(pass)
  }

  // ── Context ──

  /** Update the shared render context */
  setContext(context: IRenderContext): void {
    this._context = context
  }

  /** Get current render context */
  get context(): IRenderContext | null {
    return this._context
  }

  // ── Lifecycle ──

  /** Start the render loop */
  start(): void {
    if (this._running) return
    this._running = true
    this._scheduleFrame()
  }

  /** Stop the render loop */
  stop(): void {
    this._running = false
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
  }

  /** Pause (keep layers, stop loop) */
  pause(): void {
    this.stop()
  }

  /** Resume after pause */
  resume(): void {
    this.start()
  }

  /** Manual render one frame (for single-shot renders) */
  renderFrame(): void {
    this._doRender(performance.now())
  }

  /** Destroy — clean up all resources */
  destroy(): void {
    this.stop()
    document.removeEventListener('visibilitychange', this._onVisibilityChange)
    this._layers.clear()
    this._passes.length = 0
    this._context = null
    this.onFrame = undefined
  }

  /** Whether the loop is currently running */
  get running(): boolean {
    return this._running
  }

  // ── Internal ──

  private _scheduleFrame(): void {
    if (!this._running) return
    this._rafId = requestAnimationFrame((ts) => {
      this._doRender(ts)
      this._scheduleFrame()
    })
  }

  private _doRender(timestamp: number): void {
    const ctx = this._context
    if (!ctx) return

    this.frameCount++

    // Render each pass
    for (const pass of this._passes) {
      const { ctx: canvasCtx, width, height } = ctx

      // Clear for this pass
      if (pass.clearColor && pass.clearColor !== 'transparent') {
        canvasCtx.fillStyle = pass.clearColor
        canvasCtx.fillRect(0, 0, width, height)
      } else if (pass.clearColor === 'transparent') {
        canvasCtx.clearRect(0, 0, width, height)
      }

      // Render each layer in z-order
      for (const layerId of pass.layers) {
        const layer = this._layers.get(layerId)
        if (layer && layer.ready) {
          layer.render(ctx)
        }
      }
    }

    this.onFrame?.(timestamp)
  }

  private _onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pause()
    } else {
      this.resume()
    }
  }
}
