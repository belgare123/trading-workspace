/**
 * LayoutService.ts — 2.0.3 Layout Service.
 *
 * Manages layout presets. Each layout is a named snapshot of the
 * FlexLayout model JSON. Multiple layouts (Default, Research, Trading, etc.)
 * can coexist and be switched at runtime.
 *
 * Concepts separated:
 *   Workspace → Layout → Panels → State
 */

import { Model } from 'flexlayout-react'
import type { IJsonModel } from 'flexlayout-react'
import type { LayoutServiceApi, LayoutPreset } from './types'
import { buildDefaultLayoutJson } from './DockManager'
import { useLayoutStore } from './store'

const BUILT_IN_PRESETS: LayoutPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Orders + Positions | Equity + Trades + Chart | Logs',
    modelJson: buildDefaultLayoutJson(),
  },
  {
    id: 'trading',
    name: 'Trading',
    description: 'Focused on order entry and positions',
    modelJson: {
      global: { tabEnableClose: true, tabSetTabLocation: 'top' },
      layout: {
        type: 'row',
        children: [
          {
            type: 'tabset',
            weight: 30,
            children: [
              { type: 'tab', name: 'Orders', config: { panelId: 'orders' }, enableClose: false },
              { type: 'tab', name: 'Positions', config: { panelId: 'positions' } },
            ],
          },
          {
            type: 'tabset',
            weight: 50,
            children: [
              { type: 'tab', name: 'Chart', config: { panelId: 'chart' } },
            ],
          },
          {
            type: 'tabset',
            weight: 20,
            children: [
              { type: 'tab', name: 'Trades', config: { panelId: 'trades' } },
            ],
          },
        ],
      },
      borders: [
        { type: 'border', location: 'bottom', children: [{ type: 'tab', name: 'Logs', config: { panelId: 'logs' } }] },
      ],
    } as IJsonModel,
  },
  {
    id: 'analysis',
    name: 'Analysis',
    description: 'Focused on analytics and equity',
    modelJson: {
      global: { tabEnableClose: true, tabSetTabLocation: 'top' },
      layout: {
        type: 'row',
        children: [
          {
            type: 'tabset',
            weight: 50,
            children: [
              { type: 'tab', name: 'Equity', config: { panelId: 'equity' } },
              { type: 'tab', name: 'Strategy', config: { panelId: 'strategy' } },
            ],
          },
          {
            type: 'tabset',
            weight: 50,
            children: [
              { type: 'tab', name: 'Trades', config: { panelId: 'trades' } },
              { type: 'tab', name: 'Chart', config: { panelId: 'chart' } },
            ],
          },
        ],
      },
    } as IJsonModel,
  },
  {
    id: 'replay',
    name: 'Replay',
    description: 'Replay + Charts + Logs',
    modelJson: {
      global: { tabEnableClose: true, tabSetTabLocation: 'top' },
      layout: { type: 'row', children: [{ type: 'tabset', weight: 100, children: [{ type: 'tab', name: 'Chart', config: { panelId: 'chart' } }] }] },
    } as IJsonModel,
  },
]

/**
 * Create the Layout Service API.
 * @param getModel - Function returning the current FlexLayout Model
 * @param setModel - State setter to replace the model
 */
export function createLayoutService(
  getModel: () => Model,
  setModel?: (m: Model) => void,
): LayoutServiceApi {
  const STORAGE_KEY = 'workspace-ui:saved-layouts'

  function loadSavedLayouts(): LayoutPreset[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as LayoutPreset[]
    } catch { /* ignore */ }
    return []
  }

  function persistAll(saved: LayoutPreset[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch { /* ignore */ }
  }

  function applyModelJson(modelJson: unknown): void {
    if (!setModel) return
    try {
      const newModel = Model.fromJson(modelJson as IJsonModel)
      setModel(newModel)
    } catch (e) {
      console.error('[LayoutService] Failed to apply layout:', e)
    }
  }

  // Load saved layouts into Zustand store
  const saved = loadSavedLayouts()
  saved.forEach((p) => {
    useLayoutStore.getState().saveLayout(p.name, p.modelJson)
  })

  return {
    saveLayout(name: string) {
      const modelJson = getModel().toJson()
      useLayoutStore.getState().saveLayout(name, modelJson)
      // Persist to localStorage
      const all = loadSavedLayouts()
      const existing = all.findIndex((p) => p.name === name)
      const entry: LayoutPreset = { id: `user-${name}`, name, description: `Saved layout: ${name}`, modelJson }
      if (existing >= 0) {
        all[existing] = entry
      } else {
        all.push(entry)
      }
      persistAll(all)
    },

    loadLayout(name: string): boolean {
      const savedLayouts = loadSavedLayouts()
      const found = savedLayouts.find((p) => p.name === name)
      if (found) {
        applyModelJson(found.modelJson)
        useLayoutStore.getState().setActiveLayout(name)
        return true
      }
      // Try presets
      const preset = BUILT_IN_PRESETS.find((p) => p.name === name)
      if (preset) {
        applyModelJson(preset.modelJson)
        useLayoutStore.getState().setActiveLayout(name)
        return true
      }
      return false
    },

    deleteLayout(name: string) {
      useLayoutStore.getState().deleteLayout(name)
      const all = loadSavedLayouts().filter((p) => p.name !== name)
      persistAll(all)
    },

    listLayouts(): string[] {
      const saved = loadSavedLayouts().map((p) => p.name)
      const presetNames = BUILT_IN_PRESETS.map((p) => p.name)
      return [...new Set([...saved, ...presetNames])]
    },

    getPreset(id: string): LayoutPreset | undefined {
      return BUILT_IN_PRESETS.find((p) => p.id === id)
    },

    listPresets(): LayoutPreset[] {
      return [...BUILT_IN_PRESETS]
    },

    resetToDefault() {
      applyModelJson(buildDefaultLayoutJson())
    },
  }
}
