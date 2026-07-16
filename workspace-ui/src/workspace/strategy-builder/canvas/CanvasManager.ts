// ── CanvasManager — Rendering surface with layer stack ──
//
// Manages the rendering layers, their stacking order, and
// invalidation.
//
// @since 3.6.1

export interface CanvasLayerHandle {
  id: string
  visible: boolean
  opacity: number
  zIndex: number
}

export class CanvasManager {
  private _canvas: HTMLCanvasElement
  private _ctx: CanvasRenderingContext2D | null
  private _layers: Map<string, CanvasLayerHandle> = new Map()
  private _container: HTMLElement

  constructor(
    container: HTMLElement,
    width?: number,
    height?: number,
  ) {
    this._container = container
    this._canvas = document.createElement('canvas')
    this._canvas.style.position = 'absolute'
    this._canvas.style.top = '0'
    this._canvas.style.left = '0'
    this._canvas.style.width = '100%'
    this._canvas.style.height = '100%'
    this._container.style.position = 'relative'
    this._container.appendChild(this._canvas)
    this._ctx = this._canvas.getContext('2d')
    if (width && height) this.resize(width, height)
    else this._syncSize()
  }

  get element(): HTMLCanvasElement {
    return this._canvas
  }

  getContext(): CanvasRenderingContext2D | null {
    return this._ctx
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1
    this._canvas.width = width * dpr
    this._canvas.height = height * dpr
    this._canvas.style.width = `${width}px`
    this._canvas.style.height = `${height}px`
    if (this._ctx) this._ctx.scale(dpr, dpr)
  }

  addLayer(id: string, zIndex: number): CanvasLayerHandle {
    const handle: CanvasLayerHandle = { id, visible: true, opacity: 1, zIndex }
    this._layers.set(id, handle)
    return handle
  }

  removeLayer(id: string): void {
    this._layers.delete(id)
  }

  getLayer(id: string): CanvasLayerHandle | undefined {
    return this._layers.get(id)
  }

  setLayerVisibility(id: string, visible: boolean): void {
    const layer = this._layers.get(id)
    if (layer) layer.visible = visible
  }

  clearAll(): void {
    if (!this._ctx) return
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
  }

  /** Match container size (call on resize) */
  private _syncSize(): void {
    const rect = this._container.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      this.resize(rect.width, rect.height)
    }
  }

  destroy(): void {
    this._canvas.remove()
    this._ctx = null
    this._layers.clear()
  }
}
