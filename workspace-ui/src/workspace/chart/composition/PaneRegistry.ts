// ── PaneRegistry — singleton registry of pane definitions ──
// @since 3.3.7

import type { PaneDefinition } from './PaneDefinition'

export class PaneRegistry {
  private static _instance: PaneRegistry
  private readonly _defs = new Map<string, PaneDefinition>()

  static get instance(): PaneRegistry {
    if (!PaneRegistry._instance) {
      PaneRegistry._instance = new PaneRegistry()
    }
    return PaneRegistry._instance
  }

  register(def: PaneDefinition): void {
    if (this._defs.has(def.id)) return
    this._defs.set(def.id, def)
  }

  get(id: string): PaneDefinition | undefined {
    return this._defs.get(id)
  }

  list(): PaneDefinition[] {
    return Array.from(this._defs.values())
  }

  clear(): void {
    this._defs.clear()
  }
}
