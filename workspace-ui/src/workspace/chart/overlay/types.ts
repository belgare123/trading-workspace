// ── Domain types for Overlay Engine (Sprint 3.3.6) ──
// Overlay instances are read-only, system-generated annotations on the chart.
// Unlike DrawingInstance, they have no anchors, no style, no interactive editing.

/** Category grouping for overlays */
export type OverlayCategory = 'price' | 'trade' | 'alert' | 'volume' | 'session' | 'custom'

/** Primary position of an overlay in market or pixel coordinates */
export interface OverlayPosition {
  /** Market time (seconds) — optional, for time-anchored overlays */
  readonly time?: number
  /** Market price — optional, for price-anchored overlays */
  readonly price?: number
  /** Pixel X — optional, for axis-aligned overlays (y-axis volume profile) */
  readonly x?: number
  /** Pixel Y — optional, for axis-aligned overlays (x-axis markers) */
  readonly y?: number
}

/**
 * Context passed to OverlayDefinition.render().
 * Provides canvas context, coordinate transforms, and chart dimensions.
 */
export interface OverlayRenderContext {
  /** Canvas 2D context to draw on */
  readonly ctx: CanvasRenderingContext2D
  /** Convert market time → pixel x */
  readonly timeToPixel: (time: number) => number
  /** Convert market price → pixel y */
  readonly priceToPixel: (price: number) => number
  /** Convert pixel x → market time */
  readonly pixelToTime: (x: number) => number
  /** Convert pixel y → market price */
  readonly pixelToPrice: (y: number) => number
  readonly width: number
  readonly height: number
  readonly dpr: number
}
