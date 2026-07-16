// ── Strategy Builder Foundation Types ──
//
// Pure UI infrastructure types — no domain logic references.
//
// @since 3.6.1

// ═══════════════════════════════════════
// Spatial / Math
// ═══════════════════════════════════════

export interface Point2D {
  x: number
  y: number
}

export interface Box2D {
  x: number
  y: number
  width: number
  height: number
}

export interface Size2D {
  width: number
  height: number
}

export interface Transform2D {
  translateX: number
  translateY: number
  scale: number
}

// ═══════════════════════════════════════
// Viewport
// ═══════════════════════════════════════

export interface ViewportSnapshot {
  originX: number
  originY: number
  zoom: number
  minZoom: number
  maxZoom: number
}

// ═══════════════════════════════════════
// Interaction
// ═══════════════════════════════════════

export interface InteractionEvent {
  readonly type: string
  readonly position: Point2D
  readonly screenPosition: Point2D
  readonly buttons: number
  readonly modifiers: {
    ctrl: boolean
    shift: boolean
    alt: boolean
    meta: boolean
  }
  readonly timestamp: number
}

export interface PointerState {
  isDown: boolean
  position: Point2D
  startPosition: Point2D | null
  timestamp: number
}

export interface DragState {
  start: Point2D
  current: Point2D
  delta: Point2D
  totalDelta: Point2D
}

// ═══════════════════════════════════════
// Selection
// ═══════════════════════════════════════

export type SelectionMode = 'none' | 'replace' | 'add' | 'remove' | 'toggle' | 'marquee'

export interface SelectionState {
  selectedIds: string[]
  marqueeRect: Box2D | null
  mode: SelectionMode
  lastClickedId: string | null
}

export interface HitTestResult {
  readonly hit: boolean
  readonly id: string | null
}

// ═══════════════════════════════════════
// Rendering
// ═══════════════════════════════════════

export interface RenderFrame {
  timestamp: number
  dirtyRects: Box2D[] | null
  viewport: ViewportSnapshot
}

// ═══════════════════════════════════════
// Canvas Layer
// ═══════════════════════════════════════

export interface CanvasLayer {
  id: string
  zIndex: number
  visible: boolean
  opacity: number
}
