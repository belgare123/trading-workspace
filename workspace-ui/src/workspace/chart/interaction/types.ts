// ── Interaction Engine domain types (Sprint 3.3.5) ──

/** Tool modes for the currently active drawing tool */
export type ToolMode =
  | 'select'
  | 'trend-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'rectangle'
  | 'text'
  | 'fib'

/** Resize handle positions */
export type ResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

/** Result of hit-testing a pixel point against an instance */
export interface HitResult {
  /** The hit instance id */
  readonly instanceId: string
  /** Which anchor the point is near (for anchor drag) */
  readonly anchorIndex?: number
  /** Which resize handle was hit (for resize) */
  readonly handle?: ResizeHandle
  /** Pixel distance from the test point (lower = closer) */
  readonly distance: number
}

/** Normalised pointer event data, independent of DOM event type */
export interface PointerEventData {
  readonly pixelX: number
  readonly pixelY: number
  readonly marketTime: number
  readonly marketPrice: number
  readonly altKey: boolean
  readonly shiftKey: boolean
}

/** Context passed to DrawingDefinition.hitTest() */
export interface DrawingHitContext {
  readonly timeToPixel: (time: number) => number
  readonly priceToPixel: (price: number) => number
}

/** Configuration for InteractionRuntime */
export interface InteractionConfig {
  /** Hit-test pixel distance threshold (default 8) */
  hitThreshold?: number
}

/** Default hit-test threshold in pixels */
export const DEFAULT_HIT_THRESHOLD = 8
