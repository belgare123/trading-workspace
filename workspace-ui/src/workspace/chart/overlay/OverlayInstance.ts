// ── OverlayInstance — a single overlay element on the chart ──
// Created by Runtime services (not by users).
// Read-only by design — no anchors, no style, no interactive editing.
//
// @since 3.3.6

import type { OverlayPosition } from './types'

let _nextId = 1

export class OverlayInstance {
  /** Unique instance id (e.g. 'price-marker_1', 'order-marker_3') */
  readonly id: string

  /** Id of the OverlayDefinition that created this instance */
  readonly definitionId: string

  /** Primary position in market or pixel coordinates */
  position?: OverlayPosition

  /**
   * Flexible payload interpreted by the overlay's render().
   * Each builtin defines its own expected shape.
   */
  data: Record<string, unknown>

  /** Whether this instance is visible (drawn on canvas) */
  visible: boolean

  /** Optional z-order hint (default 0, higher = drawn later) */
  zIndex: number

  constructor(
    defId: string,
    position?: OverlayPosition,
    data?: Record<string, unknown>,
    _id?: string,
  ) {
    this.id = _id ?? `${defId}_${_nextId++}`
    this.definitionId = defId
    this.position = position
    this.data = data ?? {}
    this.visible = true
    this.zIndex = 0
  }

  /** Convenience setter for position. Returns this for chaining. */
  setPosition(pos: OverlayPosition): this {
    this.position = pos
    return this
  }

  /** Convenience setter for data. Returns this for chaining. */
  setData(key: string, value: unknown): this {
    this.data[key] = value
    return this
  }

  /** Shallow clone for runtime manipulation */
  clone(): OverlayInstance {
    const c = new OverlayInstance(this.definitionId, { ...this.position }, { ...this.data })
    c.visible = this.visible
    c.zIndex = this.zIndex
    return c
  }
}
