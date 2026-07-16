// ── OverlayDefinition — contract for a chart overlay type ──
// Each overlay type (PriceMarker, OrderMarker, VolumeProfile, etc.)
// implements this interface and registers with OverlayRegistry.
//
// Overlays are read-only, system-generated annotations.
// They contrast with Drawings (user-created, interactive, serialized).
//
// @since 3.3.6

import type { OverlayInstance } from './OverlayInstance'
import type { OverlayCategory, OverlayRenderContext } from './types'

export interface OverlayDefinition {
  /** Unique definition id (e.g. 'price-marker', 'order-marker') */
  readonly id: string

  /** Human-readable name (e.g. 'Price Marker', 'Order Marker') */
  readonly name: string

  /** Category for grouping in UI */
  readonly category: OverlayCategory

  /**
   * Render this overlay instance onto the canvas.
   * Called every frame for each visible instance.
   */
  render(context: OverlayRenderContext, instance: OverlayInstance): void

  /**
   * Optional hit-test for future overlay interaction.
   * Same contract as DrawingDefinition.hitTest:
   * returns pixel distance to the overlay, or null if no hit.
   */
  hitTest?(
    point: { x: number; y: number },
    instance: OverlayInstance,
    context: OverlayRenderContext,
  ): number | null
}
