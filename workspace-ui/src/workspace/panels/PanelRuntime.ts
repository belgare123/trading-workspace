/**
 * PanelRuntime — bridge between Layout Engine and Panel/Widget Registries
 *
 * Responsibilities:
 * - Resolves each Panel in the active layout to a PanelDefinition
 * - Provides PanelContext facades (no direct access to LayoutEngine)
 * - Tracks panel state across layout switches
 * - Coordinates PanelDefinition.render(widgetData) → React component
 *
 * @since 3.2.2
 */

import type { LayoutEngine } from '../layout/LayoutEngine'
import type { Panel, PanelId, PanelState } from '../layout/types'
import type { PanelRegistry } from './PanelRegistry'
import type { PanelDefinition, PanelContext, PanelActions } from './PanelDefinition'

export interface PanelRuntimeOptions {
  engine: LayoutEngine
  panelRegistry: PanelRegistry
}

/**
 * PanelRuntime — singleton service, orchestrates panel lifecycle.
 * Not a React component; consumed via PanelContext React context.
 */
export class PanelRuntime {
  private engine: LayoutEngine
  private panelRegistry: PanelRegistry
  /** Per-panel state keyed by PanelId (survives layout switches) */
  private panelStates = new Map<PanelId, PanelState>()
  private _onStateChange?: () => void

  constructor(opts: PanelRuntimeOptions) {
    this.engine = opts.engine
    this.panelRegistry = opts.panelRegistry
  }

  // ── Subscriptions ──

  subscribe(cb: () => void): () => void {
    this._onStateChange = cb
    return () => {
      this._onStateChange = undefined
    }
  }

  private notify(): void {
    this._onStateChange?.()
  }

  // ── Panel Resolution ──

  /** Get the PanelDefinition for a given panel (falls back to widgetId) */
  getDefinitionForPanel(panel: Panel): PanelDefinition | undefined {
    const defId = panel.definition || panel.widgetId
    return this.panelRegistry.get(defId) || this.panelRegistry.getByWidgetId(panel.widgetId)
  }

  /** Resolve all panels in the current layout */
  getResolvedPanels(): Array<{ panel: Panel; definition?: PanelDefinition }> {
    return this.engine.current.panels.map(panel => ({
      panel,
      definition: this.getDefinitionForPanel(panel),
    }))
  }

  // ── Panel State ──

  getPanelState(panelId: PanelId): PanelState {
    if (!this.panelStates.has(panelId)) {
      this.panelStates.set(panelId, {})
    }
    return this.panelStates.get(panelId)!
  }

  setPanelState(panelId: PanelId, key: string, value: unknown): void {
    const state = this.getPanelState(panelId)
    state[key] = value
    this.notify()
  }

  /** Clean up state for removed panels */
  pruneStates(activePanelIds: PanelId[]): void {
    const active = new Set(activePanelIds)
    for (const id of this.panelStates.keys()) {
      if (!active.has(id)) {
        this.panelStates.delete(id)
      }
    }
  }

  // ── PanelContext Factory ──

  /** Create a PanelContext facade for a given panel */
  createPanelContext(panel: Panel): PanelContext {
    const layout = this.engine.current

    const actions: PanelActions = {
      close: () => {
        this.engine.removePanel(panel.id)
        this.panelStates.delete(panel.id)
        this.notify()
      },

      float: () => {
        this.engine.toggleFloating(panel.id)
      },

      pin: () => {
        this.engine.togglePinned(panel.id)
      },

      collapse: () => {
        this.engine.toggleCollapsed(panel.id)
      },

      minimize: () => {
        this.engine.toggleMinimized(panel.id)
      },

      maximize: () => {
        this.engine.updatePanel(panel.id, { x: 0, y: 0, width: 1, height: 1 })
      },

      split: (direction, widgetId, title) => {
        this.engine.splitPanel(panel.id, direction, {
          id: crypto.randomUUID(),
          widgetId,
          title,
          position: { x: 0, y: 0, width: 1, height: 1 },
          tabs: [],
          floating: false,
          pinned: false,
          collapsed: false,
          minimized: false,
          state: {},
        })
      },

      move: (x, y, width, height) => {
        this.engine.updatePanel(panel.id, { x, y, width, height })
      },

      rename: (title: string) => {
        panel.title = title
        this.engine.save()
        this.notify()
      },
    }

    return {
      panel,
      layout: { id: layout.id, name: layout.name },
      state: this.getPanelState(panel.id),
      setState: (key, value) => this.setPanelState(panel.id, key, value),
      actions,
    }
  }
}
