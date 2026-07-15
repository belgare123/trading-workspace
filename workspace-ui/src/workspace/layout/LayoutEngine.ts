/**
 * LayoutEngine — core controller for workspace layout management
 *
 * Responsibilities:
 * - Manages active layout state
 * - Panel CRUD (add, remove, move, resize)
 * - Split operations (left, right, top, bottom)
 * - Links to LayoutRegistry (presets) and LayoutSerializer (persistence)
 * - Provides reactive state for the Panel Runtime
 *
 * @since 3.2.0
 */

import type { WorkspaceLayout, Panel, PanelId, LayoutId, PanelPosition, TabSpec } from './types'
import { createWorkspaceLayout, addPanel, removePanel, getPanelById, cloneWorkspaceLayout } from './WorkspaceLayout'
import { layoutRegistry } from './LayoutRegistry'
import { persistState, loadPersistedState, createDefaultPersistenceState, exportLayout, importLayout } from './LayoutSerializer'
import { validateLayout } from './LayoutValidator'
import type { ValidationResult } from './LayoutValidator'
import type { WorkspacePersistenceState } from './types'

export type LayoutChangeHandler = (layout: WorkspaceLayout) => void

// ── Direction for panel splits ──

export type SplitDirection = 'left' | 'right' | 'top' | 'bottom'

/**
 * LayoutEngine — singleton service, not a React hook.
 * React components consume it via a hook or context.
 */
export class LayoutEngine {
  private _state: WorkspacePersistenceState
  private _current: WorkspaceLayout
  private onChange?: LayoutChangeHandler

  constructor() {
    // Try restoring persisted state
    const persisted = loadPersistedState()
    if (persisted) {
      this._state = persisted
      const restored = persisted.layouts[persisted.activeLayout]
      this._current = restored ? cloneWorkspaceLayout(restored) : this.loadDefault()
    } else {
      this._state = this.buildDefaultState()
      this._current = this.buildDefaultLayout()
    }
  }

  // ── Public accessors ──

  get current(): WorkspaceLayout {
    return this._current
  }

  get activeLayoutId(): LayoutId {
    return this._state.activeLayout
  }

  get layouts(): WorkspaceLayout[] {
    return Object.values(this._state.layouts)
  }

  get state(): WorkspacePersistenceState {
    return this._state
  }

  // ── Lifecycle ──

  /** Subscribe to layout changes */
  subscribe(handler: LayoutChangeHandler): () => void {
    this.onChange = handler
    return () => {
      this.onChange = undefined
    }
  }

  /** Notify subscribers */
  private notify(): void {
    this.onChange?.(this._current)
  }

  /** Save current state to localStorage */
  save(): void {
    // Sync current layout into state
    this._state.layouts[this._current.id] = cloneWorkspaceLayout(this._current)
    persistState(this._state)
  }

  // ── Layout switching ──

  /** Switch to a different layout */
  switchLayout(id: LayoutId): boolean {
    const target = this._state.layouts[id] || layoutRegistry.get(id)
    if (!target) return false
    // Sync current before switching
    this._state.layouts[this._current.id] = cloneWorkspaceLayout(this._current)
    this._current = cloneWorkspaceLayout(target)
    this._state.activeLayout = id
    this.save()
    this.notify()
    return true
  }

  // ── Panel CRUD ──

  /** Add a new panel at the next available position */
  addPanel(panel: Panel): void {
    // Auto-position if at default
    if (panel.position.x === 0 && panel.position.y === 0 && panel.position.width === 1 && panel.position.height === 1) {
      const pos = this.nextAvailablePosition()
      panel.position = pos
    }
    addPanel(this._current, panel)
    this.save()
    this.notify()
  }

  /** Remove a panel */
  removePanel(id: PanelId): void {
    removePanel(this._current, id)
    this.save()
    this.notify()
  }

  /** Move/resize a panel */
  updatePanel(id: PanelId, position: Partial<PanelPosition>): void {
    const panel = getPanelById(this._current, id)
    if (!panel) return
    Object.assign(panel.position, position)
    this.save()
    this.notify()
  }

  /** Toggle floating for a panel */
  toggleFloating(id: PanelId): void {
    const panel = getPanelById(this._current, id)
    if (!panel) return
    panel.floating = !panel.floating
    this.save()
    this.notify()
  }

  /** Toggle collapsed state */
  toggleCollapsed(id: PanelId): void {
    const panel = getPanelById(this._current, id)
    if (!panel) return
    panel.collapsed = !panel.collapsed
    this.save()
    this.notify()
  }

  /** Toggle pin */
  togglePinned(id: PanelId): void {
    const panel = getPanelById(this._current, id)
    if (!panel) return
    panel.pinned = !panel.pinned
    this.save()
    this.notify()
  }

  /** Minimize/restore */
  toggleMinimized(id: PanelId): void {
    const panel = getPanelById(this._current, id)
    if (!panel) return
    panel.minimized = !panel.minimized
    this.save()
    this.notify()
  }

  // ── Split operations ──

  /** Split a panel in a direction, creating a new panel in the remaining space */
  splitPanel(sourceId: PanelId, direction: SplitDirection, newPanel: Panel): boolean {
    const source = getPanelById(this._current, sourceId)
    if (!source) return false

    const { x, y, width, height } = source.position

    switch (direction) {
      case 'left': {
        source.position = { x, y, width: width * 0.5, height }
        newPanel.position = { x: x + width * 0.5, y, width: width * 0.5, height }
        break
      }
      case 'right': {
        source.position = { x: x + width * 0.5, y, width: width * 0.5, height }
        newPanel.position = { x, y, width: width * 0.5, height }
        break
      }
      case 'top': {
        const halfHeight = height * 0.5
        source.position = { x, y, width, height: halfHeight }
        newPanel.position = { x, y: y + halfHeight, width, height: halfHeight }
        break
      }
      case 'bottom': {
        const halfH = height * 0.5
        source.position = { x, y: y + halfH, width, height: halfH }
        newPanel.position = { x, y, width, height: halfH }
        break
      }
    }

    addPanel(this._current, newPanel)
    this.save()
    this.notify()
    return true
  }

  // ── Tabs ──

  /** Add a tab to a panel */
  addTab(panelId: PanelId, tab: TabSpec): void {
    const panel = getPanelById(this._current, panelId)
    if (!panel) return
    panel.tabs.push(tab)
    this.save()
    this.notify()
  }

  /** Remove a tab from a panel */
  removeTab(panelId: PanelId, tabId: string): void {
    const panel = getPanelById(this._current, panelId)
    if (!panel) return
    const idx = panel.tabs.findIndex(t => t.id === tabId)
    if (idx !== -1) panel.tabs.splice(idx, 1)
    this.save()
    this.notify()
  }

  /** Activate a tab */
  activateTab(panelId: PanelId, tabId: string): void {
    const panel = getPanelById(this._current, panelId)
    if (!panel) return
    panel.activeTab = tabId
    this.notify()
  }

  // ── Validation ──

  /** Validate current layout */
  validate(knownWidgetIds?: Set<string>): ValidationResult {
    return validateLayout(this._current, knownWidgetIds)
  }

  // ── Import / Export ──

  /** Export current layout as JSON string */
  exportCurrent(): string {
    return exportLayout(this._current)
  }

  /** Import a layout from JSON string */
  importLayout(raw: string): boolean {
    const layout = importLayout(raw)
    if (!layout) return false
    this._state.layouts[layout.id] = layout
    this._current = cloneWorkspaceLayout(layout)
    this._state.activeLayout = layout.id
    this.save()
    this.notify()
    return true
  }

  // ── Reset ──

  /** Reset current layout to default preset */
  resetToDefault(): void {
    const defaultLayout = layoutRegistry.get('default')
    if (defaultLayout) {
      this._current = cloneWorkspaceLayout(defaultLayout)
      this._state.layouts[defaultLayout.id] = cloneWorkspaceLayout(defaultLayout)
      this._state.activeLayout = defaultLayout.id
      this.save()
      this.notify()
    }
  }

  // ── Private helpers ──

  private buildDefaultLayout(): WorkspaceLayout {
    const preset = layoutRegistry.get('default')
    if (preset) return cloneWorkspaceLayout(preset)
    return createWorkspaceLayout('default', 'Default')
  }

  private buildDefaultState(): WorkspacePersistenceState {
    const def = this.buildDefaultLayout()
    return createDefaultPersistenceState({ [def.id]: def }, def.id)
  }

  private loadDefault(): WorkspaceLayout {
    return this.buildDefaultLayout()
  }

  /** Find the next available position for a new panel */
  private nextAvailablePosition(): PanelPosition {
    const { panels } = this._current
    if (panels.length === 0) return { x: 0, y: 0, width: 1, height: 1 }

    // Simple heuristic: place in the first quadrant that doesn't overlap
    const candidates: PanelPosition[] = [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ]

    for (const pos of candidates) {
      const overlaps = panels.some(
        p =>
          p.position.x < pos.x + pos.width &&
          p.position.x + p.position.width > pos.x &&
          p.position.y < pos.y + pos.height &&
          p.position.y + p.position.height > pos.y,
      )
      if (!overlaps) return pos
    }

    // Fallback: place at bottom with full width
    const maxY = Math.max(...panels.map(p => p.position.y + p.position.height), 0)
    return { x: 0, y: maxY, width: 1, height: 0.3 }
  }
}

/** Singleton — engine instance for the app */
export const layoutEngine = new LayoutEngine()
