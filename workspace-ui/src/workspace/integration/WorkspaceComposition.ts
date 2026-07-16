/**
 * WorkspaceComposition.ts — Module lifecycle orchestration
 *
 * Thin orchestration layer that initializes platform modules
 * and manages their lifecycles. This is NOT a new runtime — it
 * simply coordinates the existing module registries and runtimes.
 *
 * Responsibilities:
 * - Initialize registries on boot
 * - Create and manage module runtime instances
 * - Wire event buses across modules
 * - Coordinate startup/shutdown sequences
 *
 * @since 3.7.1
 */

import { layoutRegistry } from '../layout/LayoutRegistry'
import { panelRegistry } from '../panels/PanelRegistry'
import { registerLayoutPresets } from '../layout/LayoutPresets'
import { registerDefaultBindings } from './WorkspaceBindings'

// ── Module status tracking ──

export type ModuleStatus = 'uninitialized' | 'initializing' | 'ready' | 'error'

export interface ModuleState {
  name: string
  status: ModuleStatus
  error?: string
}

// ── Composition event types ──

export interface CompositionEventMap {
  'module:status': { module: string; status: ModuleStatus; error?: string }
  'composition:ready': {}
  'composition:error': { module: string; error: string }
}

export type CompositionEventHandler = (event: keyof CompositionEventMap, detail: unknown) => void

// ── Composition ──

export class WorkspaceComposition {
  private _modules = new Map<string, ModuleState>()
  private _listeners: Array<{
    event: keyof CompositionEventMap | '*'
    handler: CompositionEventHandler
  }> = []

  // ── Module lifecycle ──

  /**
   * Initialize the layout subsystem (always first).
   */
  initLayout(): void {
    this.setModuleStatus('layout', 'initializing')
    registerLayoutPresets()
    // LayoutEngine is already instantiated as a module-level singleton.
    // This ensures presets are registered for it to use.
    this.setModuleStatus('layout', 'ready')
  }

  /**
   * Initialize panel registry with default/built-in panel definitions.
   * This registers the platform panels (Chart, Builder, Strategy, etc.)
   * so they're available when creating layouts.
   */
  initPanels(renderMap?: Parameters<typeof registerDefaultBindings>[0]): void {
    this.setModuleStatus('panels', 'initializing')
    registerDefaultBindings(renderMap)
    this.setModuleStatus('panels', 'ready')
  }

  /**
   * Initialize the Visual Strategy Builder module.
   * Registers built-in nodes in the NodeRegistry.
   */
  initBuilder(): void {
    this.setModuleStatus('builder', 'initializing')
    // Future: register built-in nodes/variants for the Builder
    // This is done lazily by the builder module itself on import.
    this.setModuleStatus('builder', 'ready')
  }

  /**
   * Initialize the Strategy Studio module.
   * Registers built-in signals, conditions, and actions.
   */
  initStrategy(): void {
    this.setModuleStatus('strategy', 'initializing')
    // Strategy module registers builtins on import.
    this.setModuleStatus('strategy', 'ready')
  }

  /**
   * Initialize the Execution Platform.
   * Wire up runtime pipelines.
   */
  initExecution(): void {
    this.setModuleStatus('execution', 'initializing')
    // Future: initialize backtest/optimization/report runtimes
    this.setModuleStatus('execution', 'ready')
  }

  /**
   * Initialize all modules in the correct order.
   * Layout → Panels → Strategy → Builder → Execution
   */
  initAll(renderMap?: Parameters<typeof registerDefaultBindings>[0]): void {
    this.initLayout()
    this.initPanels(renderMap)
    this.initStrategy()
    this.initBuilder()
    this.initExecution()
    this.emit('composition:ready', {})
  }

  /**
   * Reset all modules — clears registries and resets status.
   * Does NOT destroy runtimes (they're module-level singletons).
   */
  resetAll(): void {
    layoutRegistry.clear()
    panelRegistry.clear()
    this._modules.clear()
    this.emit('composition:ready', {})
  }

  // ── Status ──

  getModuleState(name: string): ModuleState | undefined {
    return this._modules.get(name)
  }

  getAllModuleStates(): ModuleState[] {
    return Array.from(this._modules.values())
  }

  get isReady(): boolean {
    return Array.from(this._modules.values()).every(m => m.status === 'ready')
  }

  // ── Events ──

  on(event: keyof CompositionEventMap | '*', handler: CompositionEventHandler): () => void {
    const listener = { event, handler }
    this._listeners.push(listener)
    return () => {
      const idx = this._listeners.indexOf(listener)
      if (idx !== -1) this._listeners.splice(idx, 1)
    }
  }

  private emit<E extends keyof CompositionEventMap>(event: E, detail: CompositionEventMap[E]): void {
    for (const listener of this._listeners) {
      if (listener.event === '*' || listener.event === event) {
        try {
          listener.handler(event, detail)
        } catch (err) {
          console.error(`[WorkspaceComposition] Error in listener for '${String(event)}'`, err)
        }
      }
    }
  }

  private setModuleStatus(name: string, status: ModuleStatus, error?: string): void {
    const existing = this._modules.get(name)
    const state: ModuleState = { ...existing, name, status, error }
    this._modules.set(name, state)
    this.emit('module:status', { module: name, status, error })
  }
}

// ── Singleton ──

export const workspaceComposition = new WorkspaceComposition()
