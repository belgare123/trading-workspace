/**
 * CanvasLayer.ts — base canvas layer implementation
 *
 * Wraps an HTMLCanvasElement with HiDPI support, resize handling,
 * and a render lifecycle. Concrete layers (CandleRenderer, GridRenderer, …)
 * extend this class.
 *
 * @since 3.3.2
 */

import type { IRenderLayer, IRenderContext } from './types'

export abstract class CanvasLayer implements IRenderLayer {
  abstract readonly id: string

  /** The underlying canvas element */
  readonly canvas: HTMLCanvasElement

  /** 2D rendering context (cached) */
  protected _ctx: CanvasRenderingContext2D | null = null

  /** Current pixel dimensions */
  protected _width = 0
  protected _height = 0
  protected _dpr = 1

  /** Whether the layer has been initialized */
  protected _initialized = false

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas')
  }

  /** Initialize — get 2D context */
  initialize(_context: IRenderContext): void {
    this._ctx = this.canvas.getContext('2d')
    this._initialized = true
  }

  /** Resize with HiDPI support */
  resize(width: number, height: number, dpr: number): void {
    this._width = width
    this._height = height
    this._dpr = dpr

    const cssW = width / dpr
    const cssH = height / dpr

    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`
    this.canvas.width = width
    this.canvas.height = height
  }

  /** Update viewport (default: no-op, override for caching) */
  updateViewport(_context: IRenderContext): void {
    // Subclasses can override to invalidate caches
  }

  /** Render (abstract — subclasses implement) */
  abstract render(context: IRenderContext): void

  /** Destroy — clean up */
  destroy(): void {
    this._ctx = null
    this._initialized = false
  }

  /** Whether the layer is ready to render */
  get ready(): boolean {
    return this._initialized && this._ctx !== null
  }

  /** Cached 2D context (null if not initialized) */
  get context(): CanvasRenderingContext2D | null {
    return this._ctx
  }
}
