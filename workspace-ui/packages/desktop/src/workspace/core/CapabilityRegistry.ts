/**
 * CapabilityRegistry.ts — 2.0.x Capability Registry.
 *
 * Allows panels to declare capabilities. AI and other modules
 * can discover panels by capability rather than by ID.
 *
 * Example:
 *   AI needs a chart panel → capabilityRegistry.findAll(['chart'])
 *   Returns: ['chart', 'chart.btc', 'chart.eth']
 */

import type { PanelCapability, PanelCapabilityEntry, CapabilityRegistryApi } from './types'

type CapMap = Map<string, PanelCapability[]>

const capabilities: CapMap = new Map()

export const CapabilityRegistry: CapabilityRegistryApi = {
  register(panelId: string, caps: PanelCapability[]) {
    capabilities.set(panelId, [...caps])
  },

  update(panelId: string, caps: PanelCapability[]) {
    if (capabilities.has(panelId)) {
      capabilities.set(panelId, [...caps])
    }
  },

  unregister(panelId: string) {
    capabilities.delete(panelId)
  },

  findAll(required: PanelCapability[]): string[] {
    return Array.from(capabilities.entries())
      .filter(([, caps]) => required.every(c => caps.includes(c)))
      .map(([id]) => id)
  },

  findAny(wanted: PanelCapability[]): string[] {
    return Array.from(capabilities.entries())
      .filter(([, caps]) => wanted.some(c => caps.includes(c)))
      .map(([id]) => id)
  },

  get(panelId: string): PanelCapability[] | undefined {
    return capabilities.get(panelId)
  },

  list(): PanelCapabilityEntry[] {
    return Array.from(capabilities.entries()).map(([panelId, caps]) => ({
      panelId,
      capabilities: caps,
    }))
  },
}
