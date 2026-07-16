/**
 * LivePanels.ts — Register all Live Workspace panel definitions
 *
 * Registers all 6 core Live Trading panels into the PanelRegistry:
 *   - Connection
 *   - Orders
 *   - Positions
 *   - Account
 *   - Risk
 *   - History/Journal
 *
 * @since 4.9
 */

import { panelRegistry } from '../../panels/PanelRegistry'
import type { PanelDefinition } from '../../panels/PanelDefinition'
import { LiveConnectionPanel } from './LiveConnectionPanel'
import { LiveOrdersPanel } from './LiveOrdersPanel'
import { LivePositionsPanel } from './LivePositionsPanel'
import { LiveAccountPanel } from './LiveAccountPanel'
import { LiveRiskPanel } from './LiveRiskPanel'
import { LiveHistoryPanel } from './LiveHistoryPanel'

// ── Panel Definitions ──

const CONNECTION_PANEL: PanelDefinition = {
  id: 'live-connection',
  widgetId: 'live-connection',
  title: 'Connection',
  defaultSize: { width: 0.25, height: 0.4 },
  minSize: { width: 0.2, height: 0.2 },
  render: ctx => <LiveConnectionPanel {...ctx} />,
}

const ORDERS_PANEL: PanelDefinition = {
  id: 'live-orders',
  widgetId: 'live-orders',
  title: 'Orders',
  defaultSize: { width: 0.5, height: 0.4 },
  minSize: { width: 0.3, height: 0.2 },
  render: ctx => <LiveOrdersPanel {...ctx} />,
}

const POSITIONS_PANEL: PanelDefinition = {
  id: 'live-positions',
  widgetId: 'live-positions',
  title: 'Positions',
  defaultSize: { width: 0.5, height: 0.4 },
  minSize: { width: 0.3, height: 0.2 },
  render: ctx => <LivePositionsPanel {...ctx} />,
}

const ACCOUNT_PANEL: PanelDefinition = {
  id: 'live-account',
  widgetId: 'live-account',
  title: 'Account',
  defaultSize: { width: 0.25, height: 0.3 },
  minSize: { width: 0.2, height: 0.2 },
  render: ctx => <LiveAccountPanel {...ctx} />,
}

const RISK_PANEL: PanelDefinition = {
  id: 'live-risk',
  widgetId: 'live-risk',
  title: 'Risk',
  defaultSize: { width: 0.25, height: 0.3 },
  minSize: { width: 0.2, height: 0.2 },
  render: ctx => <LiveRiskPanel {...ctx} />,
}

const HISTORY_PANEL: PanelDefinition = {
  id: 'live-history',
  widgetId: 'live-history',
  title: 'History',
  defaultSize: { width: 0.5, height: 0.3 },
  minSize: { width: 0.3, height: 0.2 },
  render: ctx => <LiveHistoryPanel {...ctx} />,
}

/** All Live panel definitions, ordered naturally */
export const LIVE_PANEL_DEFINITIONS: PanelDefinition[] = [
  CONNECTION_PANEL,
  ORDERS_PANEL,
  POSITIONS_PANEL,
  ACCOUNT_PANEL,
  RISK_PANEL,
  HISTORY_PANEL,
]

/**
 * Register all Live Workspace panels in the PanelRegistry.
 * Safe to call multiple times (logs warning on duplicate, overwrites).
 */
export function registerLivePanels(): void {
  for (const def of LIVE_PANEL_DEFINITIONS) {
    panelRegistry.register(def, `Live Trading panel: ${def.title}`)
  }
}
