// ── CursorManager — unified cursor style management ──
// Converts interaction state to CSS cursor values.
// Prevents cursor logic from leaking into other components.

import type { ToolMode, HitResult } from './types'
import type { SelectionManager } from './SelectionManager'

/** Supported cursor styles used by the interaction engine */
export type InteractionCursor =
  | 'default'
  | 'crosshair'
  | 'pointer'
  | 'move'
  | 'ew-resize'
  | 'ns-resize'
  | 'nesw-resize'
  | 'nwse-resize'
  | 'text'

export class CursorManager {
  private _current: InteractionCursor = 'default'

  /** Get the current cursor style */
  get current(): InteractionCursor {
    return this._current
  }

  /** Get the CSS cursor value */
  get cssValue(): string {
    return this._current
  }

  /**
   * Compute the appropriate cursor based on current interaction state.
   * Call this whenever pointer position or selection state changes.
   */
  compute(
    mode: ToolMode,
    hitResult: HitResult | null,
    selection: SelectionManager,
  ): InteractionCursor {
    // Drawing tool active → crosshair
    if (mode !== 'select') {
      this._current = 'crosshair'
      return this._current
    }

    // No hit → default
    if (!hitResult) {
      this._current = 'default'
      return this._current
    }

    // Hit a resize handle → directional resize
    if (hitResult.handle) {
      switch (hitResult.handle) {
        case 'top-left':
          this._current = 'nwse-resize'
          break
        case 'top-right':
          this._current = 'nesw-resize'
          break
        case 'bottom-left':
          this._current = 'nesw-resize'
          break
        case 'bottom-right':
          this._current = 'nwse-resize'
          break
      }
      return this._current
    }

    // Selected instance → move
    if (selection.isSelected(hitResult.instanceId)) {
      this._current = 'move'
      return this._current
    }

    // Unselected instance → pointer
    this._current = 'pointer'
    return this._current
  }

  /** Force a specific cursor */
  set(cursor: InteractionCursor): void {
    this._current = cursor
  }

  /** Reset to default */
  reset(): void {
    this._current = 'default'
  }
}
