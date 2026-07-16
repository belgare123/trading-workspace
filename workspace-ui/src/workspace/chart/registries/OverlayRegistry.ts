/**
 * OverlayRegistry.ts — registry of chart overlays
 *
 * Overlays are visual layers rendered above the chart canvas:
 *   - Order/position markers
 *   - Replay controls
 *   - Selection highlights
 *   - DOM-style annotations
 *
 * @since 3.3.1
 */

import type { OverlayMeta } from '../types'

/**
 * In-memory registry of available overlays.
 */
export class OverlayRegistry {
  private readonly _overlays = new Map<string, OverlayMeta>()

  /** Register a single overlay */
  register(meta: OverlayMeta): void {
    if (this._overlays.has(meta.id)) {
      console.warn(`[OverlayRegistry] Overwriting overlay '${meta.id}'`)
    }
    this._overlays.set(meta.id, meta)
  }

  /** Register multiple overlays at once */
  registerAll(metas: OverlayMeta[]): void {
    for (const meta of metas) {
      this.register(meta)
    }
  }

  /** Get overlay meta by id */
  get(id: string): OverlayMeta | undefined {
    return this._overlays.get(id)
  }

  /** All registered overlays */
  getAll(): OverlayMeta[] {
    return Array.from(this._overlays.values())
  }

  /** Check if an overlay id exists */
  has(id: string): boolean {
    return this._overlays.has(id)
  }

  /** Number of registered overlays */
  get size(): number {
    return this._overlays.size
  }
}

// ── Singleton ──

export const overlayRegistry = new OverlayRegistry()
