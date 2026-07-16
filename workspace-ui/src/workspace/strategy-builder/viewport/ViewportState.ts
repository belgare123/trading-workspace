// ── ViewportState — Coordinate system authority ──
//
// Transforms between graph (model) and screen (pixel) coordinates.
// Single source of truth for pan, zoom, and origin offset.
//
// @since 3.6.1

export interface ViewportSnapshot {
  originX: number
  originY: number
  zoom: number
  minZoom: number
  maxZoom: number
}

export interface ViewportConfig {
  originX?: number
  originY?: number
  zoom?: number
  minZoom?: number
  maxZoom?: number
}

export class ViewportState {
  originX: number
  originY: number
  zoom: number
  readonly minZoom: number
  readonly maxZoom: number

  constructor(config: ViewportConfig = {}) {
    this.originX = config.originX ?? 0
    this.originY = config.originY ?? 0
    this.zoom = config.zoom ?? 1
    this.minZoom = config.minZoom ?? 0.1
    this.maxZoom = config.maxZoom ?? 5
  }

  /** Graph coordinate → screen pixel */
  graphToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.originX) * this.zoom,
      y: (y - this.originY) * this.zoom,
    }
  }

  /** Screen pixel → graph coordinate */
  screenToGraph(x: number, y: number): { x: number; y: number } {
    return {
      x: x / this.zoom + this.originX,
      y: y / this.zoom + this.originY,
    }
  }

  /** Pan by delta in screen pixels */
  pan(dx: number, dy: number): void {
    this.originX -= dx / this.zoom
    this.originY -= dy / this.zoom
  }

  /** Zoom toward a fixed graph point */
  zoomTo(newZoom: number, centerScreenX: number, centerScreenY: number): void {
    const clamped = Math.min(this.maxZoom, Math.max(this.minZoom, newZoom))
    const graphCenter = this.screenToGraph(centerScreenX, centerScreenY)
    this.zoom = clamped
    const newScreen = this.graphToScreen(graphCenter.x, graphCenter.y)
    this.originX += (centerScreenX - newScreen.x) / this.zoom
    this.originY += (centerScreenY - newScreen.y) / this.zoom
  }

  /** Fit a bounding box into view */
  fitToView(
    box: { x: number; y: number; width: number; height: number },
    viewWidth: number,
    viewHeight: number,
    padding: number = 40,
  ): void {
    const contentW = box.width + padding * 2
    const contentH = box.height + padding * 2
    const scaleX = viewWidth / contentW
    const scaleY = viewHeight / contentH
    this.zoom = Math.min(scaleX, scaleY, this.maxZoom)
    this.originX = box.x - (viewWidth / this.zoom - box.width) / 2
    this.originY = box.y - (viewHeight / this.zoom - box.height) / 2
  }

  /** Reset to identity */
  reset(): void {
    this.originX = 0
    this.originY = 0
    this.zoom = 1
  }

  /** Snapshot for rendering */
  snapshot(): ViewportSnapshot {
    return {
      originX: this.originX,
      originY: this.originY,
      zoom: this.zoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
    }
  }

  /** Clone current state */
  clone(): ViewportState {
    const v = new ViewportState(this.snapshot())
    return v
  }
}
