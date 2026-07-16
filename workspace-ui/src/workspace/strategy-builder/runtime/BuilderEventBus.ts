// ── BuilderEventBus — Internal event system for Strategy Builder ──
//
// Lightweight typed event emitter for intra-builder communication.
// NOT the platform EventBus — this is UI-layer only.
//
// @since 3.6.1

export type BuilderEventMap = {
  /** Viewport origin / zoom changed */
  'builder:viewport:changed': { originX: number; originY: number; zoom: number }
  /** Pointer button pressed */
  'builder:pointer:down': import('../types').InteractionEvent
  /** Pointer position changed */
  'builder:pointer:move': import('../types').InteractionEvent
  /** Pointer button released */
  'builder:pointer:up': import('../types').InteractionEvent
  /** Click (down+up <4px) */
  'builder:click': import('../types').InteractionEvent
  /** Double-click */
  'builder:dblclick': import('../types').InteractionEvent
  /** Scroll wheel */
  'builder:wheel': { event: import('../types').InteractionEvent; delta: number }
  /** Drag in progress */
  'builder:drag': import('../types').DragState
  /** Selection changed */
  'builder:selection:changed': import('../types').SelectionState
  /** Frame rendered */
  'builder:rendered': import('../types').RenderFrame
  /** A node was added / removed / updated */
  'builder:nodes:changed': { added?: string[]; removed?: string[]; updated?: string[] }
  /** Graph topology changed (edges, grouping) */
  'builder:graph:changed': void
  /** Connection state changed (port drag) */
  'builder:connection:changed': import('../graph-editor/types').ConnectionState

  // ── Shell events (3.6.4) ──

  /** A node was selected */
  'builder:node:selected': { id: string; label: string }
  /** A parameter value was changed in the inspector */
  'builder:property:changed': { nodeId: string; paramId: string; value: unknown }
  /** Validation state updated */
  'builder:validation:updated': { errors: import('../shell/types').ValidationMessage[]; warnings: string[] }
  /** Search results changed */
  'builder:search:changed': { query: string; results: import('../shell/types').SearchResult[] }
  /** Palette items changed (plugin registered) */
  'builder:palette:changed': void
}

export type BuilderEventName = keyof BuilderEventMap

export class BuilderEventBus {
  private _listeners = new Map<string, Set<(...args: any[]) => void>>()

  on<E extends BuilderEventName>(event: E, fn: (data: BuilderEventMap[E]) => void): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    this._listeners.get(event)!.add(fn)
    return () => this._listeners.get(event)?.delete(fn)
  }

  off<E extends BuilderEventName>(event: E, fn: (data: BuilderEventMap[E]) => void): void {
    this._listeners.get(event)?.delete(fn)
  }

  emit<E extends BuilderEventName>(event: E, data: BuilderEventMap[E]): void {
    this._listeners.get(event)?.forEach(fn => fn(data))
  }

  clear(): void {
    this._listeners.clear()
  }
}
