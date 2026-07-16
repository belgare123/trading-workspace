// ── SelectionManager — Hit-test and marquee selection model ──
//
// Owns selection state, handles click-to-select, shift-toggle,
// and marquee (rubber-band) selection.
//
// @since 3.6.1

import type { BuilderEventBus } from '../runtime/BuilderEventBus'
import type { SelectionState, Box2D, HitTestResult } from '../types'

export interface Selectable {
  id: string
  hitTest(point: { x: number; y: number }): boolean
  getBoundingBox(): Box2D
}

export class SelectionManager {
  private _state: SelectionState = {
    selectedIds: [],
    marqueeRect: null,
    mode: 'none',
    lastClickedId: null,
  }
  private _selectables: Map<string, Selectable> = new Map()
  private _eventBus: BuilderEventBus | null = null

  connect(eventBus: BuilderEventBus): void {
    this._eventBus = eventBus
  }

  // ── Registry ──

  register(item: Selectable): void {
    this._selectables.set(item.id, item)
  }

  unregister(id: string): void {
    this._selectables.delete(id)
  }

  // ── Hit testing ──

  hitTest(point: { x: number; y: number }): HitTestResult {
    // Reverse order — topmost first
    const items = Array.from(this._selectables.values()).reverse()
    for (const item of items) {
      if (item.hitTest(point)) {
        return { hit: true, id: item.id }
      }
    }
    return { hit: false, id: null }
  }

  // ── Selection commands ──

  select(id: string, additive: boolean = false): void {
    if (additive) {
      const set = new Set(this._state.selectedIds)
      if (set.has(id)) {
        set.delete(id)
      } else {
        set.add(id)
      }
      this._state.selectedIds = Array.from(set)
    } else {
      this._state.selectedIds = [id]
    }
    this._state.lastClickedId = id
    this._notify()
  }

  selectAll(): void {
    this._state.selectedIds = Array.from(this._selectables.keys())
    this._notify()
  }

  deselectAll(): void {
    this._state.selectedIds = []
    this._state.lastClickedId = null
    this._notify()
  }

  // ── Marquee ──

  startMarquee(start: { x: number; y: number }): void {
    this._state.mode = 'marquee'
    this._state.marqueeRect = { x: start.x, y: start.y, width: 0, height: 0 }
  }

  updateMarquee(current: { x: number; y: number }): void {
    if (!this._state.marqueeRect) return
    const r = this._state.marqueeRect
    r.width = current.x - r.x
    r.height = current.y - r.y
    this._notify()
  }

  endMarquee(): void {
    const rect = this._state.marqueeRect
    if (rect) {
      const normalized = this._normalizeRect(rect)
      this._state.selectedIds = Array.from(this._selectables.values())
        .filter(s => this._rectHitTest(s.getBoundingBox(), normalized))
        .map(s => s.id)
      this._notify()
    }
    this._state.marqueeRect = null
    this._state.mode = 'none'
    this._notify()
  }

  // ── State access ──

  get state(): Readonly<SelectionState> {
    return this._state
  }

  isSelected(id: string): boolean {
    return this._state.selectedIds.includes(id)
  }

  // ── Private ──

  private _normalizeRect(r: Box2D): Box2D {
    return {
      x: r.width < 0 ? r.x + r.width : r.x,
      y: r.height < 0 ? r.y + r.height : r.y,
      width: Math.abs(r.width),
      height: Math.abs(r.height),
    }
  }

  private _rectHitTest(box: Box2D, rect: Box2D): boolean {
    return box.x < rect.x + rect.width &&
      box.x + box.width > rect.x &&
      box.y < rect.y + rect.height &&
      box.y + box.height > rect.y
  }

  private _notify(): void {
    this._eventBus?.emit('builder:selection:changed', { ...this._state })
  }
}
