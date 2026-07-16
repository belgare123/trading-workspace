// ── CrosshairSync — synchronise crosshair across panes ──
// Holds the shared crosshair position and notifies subscribers.
// The crosshair X and timestamp are the same for all panes.
// Y and price differ per pane (since each pane has its own price scale).
// @since 3.3.7

export type CrosshairListener = (x: number, timestamp: number) => void

export class CrosshairSync {
  pixelX = 0
  timestamp = 0
  visible = false

  private readonly _listeners = new Set<CrosshairListener>()

  /** Update crosshair X position — propagates to all panes */
  setPosition(pixelX: number, timestamp: number): void {
    this.pixelX = pixelX
    this.timestamp = timestamp
    this.visible = true
    for (const fn of this._listeners) {
      fn(pixelX, timestamp)
    }
  }

  /** Hide crosshair */
  hide(): void {
    this.visible = false
  }

  /** Subscribe to position changes (for pane-level crosshair renderers) */
  subscribe(fn: CrosshairListener): () => void {
    this._listeners.add(fn)
    return () => { this._listeners.delete(fn) }
  }

  /** Clear all listeners */
  clear(): void {
    this._listeners.clear()
  }
}
