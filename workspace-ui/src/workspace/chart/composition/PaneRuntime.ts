// ── PaneRuntime — manages active panes for a chart instance ──
// @since 3.3.7

import type { PaneState } from './types'

let _nextPaneId = 1
function uid(): string {
  return `pane_${_nextPaneId++}`
}

export class PaneRuntime {
  private readonly _panes: PaneState[] = []

  /** Add a pane from a definition */
  add(definitionId: string, defaultHeight: number): PaneState {
    const pane: PaneState = {
      id: uid(),
      definitionId,
      height: defaultHeight,
      visible: true,
    }
    this._panes.push(pane)
    return pane
  }

  /** Remove a pane by id */
  remove(id: string): boolean {
    const idx = this._panes.findIndex(p => p.id === id)
    if (idx === -1) return false
    this._panes.splice(idx, 1)
    return true
  }

  /** Get a pane by id */
  get(id: string): PaneState | undefined {
    return this._panes.find(p => p.id === id)
  }

  /** Get all panes (in order) */
  getAll(): PaneState[] {
    return this._panes
  }

  /** Get visible panes (in order) */
  getVisible(): PaneState[] {
    return this._panes.filter(p => p.visible)
  }

  /** Toggle visibility */
  toggle(id: string): void {
    const p = this._panes.find(x => x.id === id)
    if (p) p.visible = !p.visible
  }

  /** Set pane height ratio */
  setHeight(id: string, height: number): void {
    const p = this._panes.find(x => x.id === id)
    if (p) p.height = Math.max(0.05, Math.min(0.9, height))
  }

  /** Reorder — move pane at `from` index to `to` index */
  move(from: number, to: number): void {
    if (from < 0 || from >= this._panes.length) return
    if (to < 0 || to >= this._panes.length) return
    const [pane] = this._panes.splice(from, 1)
    this._panes.splice(to, 0, pane)
  }

  /** Clear all panes */
  clear(): void {
    this._panes.length = 0
  }

  /** Count of active panes */
  get count(): number {
    return this._panes.length
  }
}
