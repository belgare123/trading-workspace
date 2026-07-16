// ── DrawingInstance — a single drawing object on the chart ──
// Holds only market coordinates (time, price) — never pixels.
// Style is cloned from the definition at creation time.

import type { Anchor, DrawingStyle } from './types'

let _nextId = 1

export class DrawingInstance {
  /** Unique instance id (e.g. 'trend-line_1', 'rect_3') */
  readonly id: string

  /** Id of the DrawingDefinition that created this instance */
  readonly definitionId: string

  /** Anchors in market coordinates — never pixels */
  anchors: Anchor[]

  /** Whether this instance is visible (drawn on canvas) */
  visible: boolean

  /** Whether this instance is locked (immutable until unlocked) */
  locked: boolean

  /** Whether this instance is currently selected (used by Interaction Engine in 3.3.5) */
  selected: boolean

  /** Visual style (cloned from definition default at creation) */
  style: DrawingStyle

  /** Arbitrary metadata for tool-specific data (fib levels, text content, etc.) */
  metadata?: Record<string, unknown>

  constructor(defId: string, anchors: Anchor[], style: DrawingStyle, _id?: string) {
    this.id = _id ?? `${defId}_${_nextId++}`
    this.definitionId = defId
    this.anchors = anchors
    this.visible = true
    this.locked = false
    this.selected = false
    this.style = { ...style }
  }

  /** Update a single anchor by index. Returns this for chaining. */
  setAnchor(index: number, time: number, price: number): this {
    if (index >= 0 && index < this.anchors.length) {
      this.anchors[index] = { time, price }
    }
    return this
  }

  /** Add an anchor. Returns this for chaining. */
  addAnchor(time: number, price: number): this {
    this.anchors.push({ time, price })
    return this
  }

  /** Deep clone for undo snapshots */
  clone(): DrawingInstance {
    const c = new DrawingInstance(this.definitionId, this.anchors.map((a) => ({ ...a })), { ...this.style })
    c.visible = this.visible
    c.locked = this.locked
    c.selected = this.selected
    if (this.metadata) c.metadata = structuredClone(this.metadata)
    return c
  }
}
