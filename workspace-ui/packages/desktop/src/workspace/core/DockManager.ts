/**
 * DockManager.ts — 2.0.2 Dock Manager.
 *
 * Abstraction over FlexLayout. The rest of the workspace never
 * imports FlexLayout directly — only through this adapter.
 *
 * Workspace → WorkspaceDockManager → FlexLayoutAdapter → FlexLayout Model
 *
 * If FlexLayout is ever replaced, only this file needs to change.
 */

import { Model, Actions, DockLocation, type TabNode, type IJsonModel } from 'flexlayout-react'
import React, { type ComponentType } from 'react'
import type {
  DockApi,
  DockZone,
  LayoutSnapshot,
  PanelDefinition,
} from './types'
import { PanelRegistry } from './PanelRegistry'

// ── Zone mapping: logical → FlexLayout locations ─────

const ZONE_TO_LOCATION: Partial<Record<DockZone, DockLocation>> = {
  left: DockLocation.LEFT,
  right: DockLocation.RIGHT,
  center: DockLocation.CENTER,
  bottom: DockLocation.BOTTOM,
}

// ── Default layout JSON ───────────────────────────────

export function buildDefaultLayoutJson(): IJsonModel {
  return {
    global: {
      tabEnableClose: true,
      tabSetEnableDeleteWhenEmpty: true,
      tabSetEnableMaximize: true,
      tabEnablePopout: true,
      tabSetTabLocation: 'top',
    },
    layout: {
      type: 'row',
      children: [
        {
          type: 'tabset',
          weight: 35,
          children: [
            {
              type: 'tab',
              name: 'Orders',
              config: { panelId: 'orders' },
              enableClose: false,
            },
            { type: 'tab', name: 'Positions', config: { panelId: 'positions' } },
          ],
        },
        {
          type: 'tabset',
          weight: 65,
          children: [
            { type: 'tab', name: 'Equity', config: { panelId: 'equity' } },
            { type: 'tab', name: 'Trades', config: { panelId: 'trades' } },
            { type: 'tab', name: 'Chart', config: { panelId: 'chart' } },
          ],
        },
      ],
    },
    borders: [
      {
        type: 'border',
        location: 'bottom',
        children: [
          { type: 'tab', name: 'Logs', config: { panelId: 'logs' } },
        ],
      },
    ],
  }
}

// ── Find tab by panelId ───────────────────────────────

function findTabNode(model: Model, panelId: string): TabNode | undefined {
  let found: TabNode | undefined
  model.visitNodes((node) => {
    if (!found && node.getType() === 'tab') {
      const tabNode = node as TabNode
      const config = tabNode.getConfig() as { panelId?: string } | undefined
      if (config?.panelId === panelId) {
        found = tabNode
      }
    }
  })
  return found
}

// ── FlexLayout factory helper ─────────────────────────

export function createFactory(
  getPanelDef: (id: string) => PanelDefinition | undefined,
): (node: TabNode) => React.ReactNode {
  return (node: TabNode) => {
    const config = node.getConfig() as { panelId?: string } | undefined
    const panelId = config?.panelId

    if (!panelId) {
      return React.createElement('div', { className: 'panel-empty' }, 'Unknown panel')
    }

    const def = getPanelDef(panelId)
    if (!def) {
      return React.createElement('div', { className: 'panel-empty' }, `Panel not found: ${panelId}`)
    }

    const Component = def.component as ComponentType<{ panelId: string }>
    return React.createElement(Component, { panelId })
  }
}

// ── DockManager ───────────────────────────────────────

/**
 * Creates a DockApi implementation backed by FlexLayout.
 * @param model - The FlexLayout Model instance
 * @param setModel - State setter for React re-render (useState)
 * @param onModelChange - Callback when FlexLayout model changes
 */
export function createDockManager(
  getModel: () => Model,
  _setModel?: (m: Model) => void,
  _onModelChange?: (m: Model) => void,
): DockApi {
  const getActiveTabsetId = (): string | undefined => {
    const active = getModel().getActiveTabset()
    return active?.getId()
  }

  const getFirstTabsetId = (): string | undefined => {
    const root = getModel().getRootRow()
    if (!root) return undefined
    const first = root.getChildren()?.[0]
    return first?.getId()
  }

  return {
    openPanel(panelId: string, zone?: DockZone) {
      const model = getModel()
      const existing = findTabNode(model, panelId)
      if (existing) {
        model.doAction(Actions.selectTab(existing.getId()))
        return
      }

      const def = PanelRegistry.get(panelId)
      if (!def) return

      const jsonNode = {
        type: 'tab' as const,
        name: def.title,
        config: { panelId: def.id },
        enableClose: true,
      }

      if (zone) {
        const location = ZONE_TO_LOCATION[zone]
        const tabsetId = getActiveTabsetId() ?? getFirstTabsetId()
        if (tabsetId && location) {
          model.doAction(Actions.addNode(jsonNode, tabsetId, location, -1))
        }
      } else {
        const tabsetId = getActiveTabsetId() ?? getFirstTabsetId()
        if (tabsetId) {
          model.doAction(Actions.addNode(jsonNode, tabsetId, DockLocation.CENTER, -1))
        } else {
          // No tabset at all — add to root
          model.doAction(Actions.addNode(jsonNode, '', DockLocation.CENTER, -1))
        }
      }
    },

    closePanel(panelId: string) {
      const node = findTabNode(getModel(), panelId)
      if (node) {
        getModel().doAction(Actions.deleteTab(node.getId()))
      }
    },

    togglePanel(panelId: string) {
      const node = findTabNode(getModel(), panelId)
      if (node) {
        getModel().doAction(Actions.deleteTab(node.getId()))
      } else {
        this.openPanel(panelId)
      }
    },

    isPanelOpen(panelId: string): boolean {
      return !!findTabNode(getModel(), panelId)
    },

    splitPanel(panelId: string, direction: 'h' | 'v') {
      const model = getModel()
      const existing = findTabNode(model, panelId)
      if (existing) return // already open

      const def = PanelRegistry.get(panelId)
      if (!def) return

      const jsonNode = {
        type: 'tab' as const,
        name: def.title,
        config: { panelId: def.id },
        enableClose: true,
      }

      const location = direction === 'h' ? DockLocation.RIGHT : DockLocation.BOTTOM
      const tabsetId = getActiveTabsetId() ?? getFirstTabsetId()
      if (tabsetId) {
        model.doAction(Actions.addNode(jsonNode, tabsetId, location, -1))
      }
    },

    getLayoutSnapshot(): LayoutSnapshot {
      const model = getModel()
      const openPanels: string[] = []
      let activePanel: string | null = null

      model.visitNodes((node) => {
        if (node.getType() === 'tab') {
          const tabNode = node as TabNode
          const config = tabNode.getConfig() as { panelId?: string } | undefined
          if (config?.panelId) {
            openPanels.push(config.panelId)
            // TabNode's parent is a TabSetNode which has isActive()
            const parent = tabNode.getParent() as { isActive?: () => boolean } | null
            if (parent && parent.isActive?.()) {
              activePanel = config.panelId
            }
          }
        }
      })

      return { openPanels, activePanel }
    },
  }
}
