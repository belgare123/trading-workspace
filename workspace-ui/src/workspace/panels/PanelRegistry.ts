/**
 * PanelRegistry — manages PanelDefinition registrations
 *
 * @since 3.2.2
 */

import type { PanelDefinition } from './PanelDefinition'

interface PanelEntry {
  definition: PanelDefinition
  description?: string
}

export class PanelRegistry {
  private defs = new Map<string, PanelEntry>()

  register(definition: PanelDefinition, description?: string): void {
    if (this.defs.has(definition.id)) {
      if (import.meta.env.DEV) {
        console.warn(`[PanelRegistry] Overwriting '${definition.id}'`)
      }
    }
    this.defs.set(definition.id, { definition, description })
  }

  unregister(id: string): boolean {
    return this.defs.delete(id)
  }

  get(id: string): PanelDefinition | undefined {
    return this.defs.get(id)?.definition
  }

  getByWidgetId(widgetId: string): PanelDefinition | undefined {
    for (const entry of this.defs.values()) {
      if (entry.definition.widgetId === widgetId) {
        return entry.definition
      }
    }
    return undefined
  }

  getAll(): PanelDefinition[] {
    return Array.from(this.defs.values())
      .map(e => e.definition)
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  has(id: string): boolean {
    return this.defs.has(id)
  }

  clear(): void {
    this.defs.clear()
  }

  get count(): number {
    return this.defs.size
  }

  get ids(): string[] {
    return Array.from(this.defs.keys())
  }
}

/** Singleton */
export const panelRegistry = new PanelRegistry()
