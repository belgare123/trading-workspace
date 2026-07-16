/**
 * LivePanels.ts — Panel registration for Live Workspace
 *
 * Registers live trading panels (connection, orders, positions)
 * into the global PanelRegistry.
 *
 * Usage (app bootstrap):
 *   import { registerLivePanels } from 'workspace/live/live/LivePanels'
 *   registerLivePanels()
 *
 * @since 4.9
 */

import { panelRegistry } from '../../panels/PanelRegistry'
import { LiveConnectionPanel } from './LiveConnectionPanel'
import { LiveOrdersPanel } from './LiveOrdersPanel'
import { LivePositionsPanel } from './LivePositionsPanel'
import type { PanelDefinition } from '../../panels/PanelDefinition'

const CONNECTION_PANEL: PanelDefinition = {
  id: 'live-connection',
  widgetId: 'live-connection',
  title: 'Live Connection',
  defaultSize: { width: 0.25, height: 0.3 },
  minSize: { width: 0.15, height: 0.15 },
  render: (ctx) => LiveConnectionPanel(ctx),
}

const ORDERS_PANEL: PanelDefinition = {
  id: 'live-orders',
  widgetId: 'live-orders',
  title: 'Live Orders',
  defaultSize: { width: 0.5, height: 0.4 },
  minSize: { width: 0.2, height: 0.15 },
  render: (ctx) => LiveOrdersPanel(ctx),
}

const POSITIONS_PANEL: PanelDefinition = {
  id: 'live-positions',
  widgetId: 'live-positions',
  title: 'Live Positions',
  defaultSize: { width: 0.5, height: 0.4 },
  minSize: { width: 0.2, height: 0.15 },
  render: (ctx) => LivePositionsPanel(ctx),
}

/**
 * Register all live workspace panels into the global PanelRegistry.
 * Safe to call multiple times (panels are overwritten).
 */
export function registerLivePanels(): void {
  panelRegistry.register(CONNECTION_PANEL)
  panelRegistry.register(ORDERS_PANEL)
  panelRegistry.register(POSITIONS_PANEL)
}
