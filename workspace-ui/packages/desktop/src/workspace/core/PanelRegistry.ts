/**
 * PanelRegistry.ts — 2.0.1 Panel Registry.
 *
 * Dynamic registry for panel definitions. Any module can register
 * a panel with a single function call. The workspace core never
 * imports panel components directly — it only knows PanelDefinitions.
 *
 * Features: versioning, lazy loading, permissions, hot reload,
 * plugin origin, default layout hints.
 */

import type { PanelDefinition, PanelCategory } from './types'

type PanelMap = Map<string, PanelDefinition>

let panels: PanelMap = new Map()

export const PanelRegistry = {
  /**
   * Register a panel definition. If a panel with the same ID already exists,
   * the newer registration overwrites it (enables hot-reload from plugins).
   */
  register(def: PanelDefinition): void {
    panels.set(def.id, def)
  },

  /**
   * Unregister a panel by ID.
   */
  unregister(panelId: string): void {
    panels.delete(panelId)
  },

  /**
   * Get a panel definition by ID.
   */
  get(panelId: string): PanelDefinition | undefined {
    return panels.get(panelId)
  },

  /**
   * List all registered panels.
   */
  list(): PanelDefinition[] {
    return Array.from(panels.values())
  },

  /**
   * List panels filtered by category.
   */
  listByCategory(category: PanelCategory): PanelDefinition[] {
    return Array.from(panels.values()).filter(p => p.category === category)
  },

  /**
   * Check if a panel is registered.
   */
  has(panelId: string): boolean {
    return panels.has(panelId)
  },

  /**
   * Count registered panels.
   */
  count(): number {
    return panels.size
  },

  /**
   * Clear all panel registrations (for testing / workspace teardown).
   */
  clear(): void {
    panels.clear()
  },

  /**
   * Replace the entire registry (for testing).
   */
  _reset(newMap?: Map<string, PanelDefinition>): void {
    panels = newMap ?? new Map()
  },
} as const

export type PanelRegistryApi = typeof PanelRegistry
