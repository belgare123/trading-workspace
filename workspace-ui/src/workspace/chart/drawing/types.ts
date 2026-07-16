// ── Domain types for Drawing Engine (Sprint 3.3.4) ──
// Anchors use market coordinates (time, price) — never pixels.
// Pixel conversion happens only in DrawingRenderer via DrawingRenderContext.

/** Market coordinate anchor — time in seconds, price in quote currency */
export interface Anchor {
  readonly time: number
  readonly price: number
}

/** Screen-space point used in define-time constructors only */
export interface Point {
  readonly x: number
  readonly y: number
}

/** Visual style shared by all drawing types */
export interface DrawingStyle {
  lineColor?: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  fillColor?: string
  font?: string
  fontSize?: number
  opacity?: number
}

/**
 * Context passed to DrawingDefinition.render().
 * All coordinate conversion is done here — DrawingInstance holds only market coordinates.
 */
export interface DrawingRenderContext {
  /** Canvas 2D context to draw on */
  readonly ctx: CanvasRenderingContext2D
  /** Convert market time → pixel x */
  readonly timeToPixel: (time: number) => number
  /** Convert market price → pixel y */
  readonly priceToPixel: (price: number) => number
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export type DrawingCategory = 'line' | 'shape' | 'annotation' | 'fibonacci'
