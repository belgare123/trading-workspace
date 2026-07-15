/**
 * WorkspaceLayout — factory and helpers for layout creation
 *
 * @since 3.2.0
 */

import type { WorkspaceLayout, Panel, LayoutId, PanelId, TabSpec } from './types'
import { LAYOUT_VERSION } from './types'

// ── Factory ──

export function createWorkspaceLayout(
  id: LayoutId,
  name: string,
  panels?: Panel[],
): WorkspaceLayout {
  return {
    id,
    name,
    panels: panels || [],
    version: LAYOUT_VERSION,
  }
}

// ── Panel factory ──

export function createPanel(
  id: PanelId,
  widgetId: string,
  title: string,
  tabs?: TabSpec[],
): Panel {
  return {
    id,
    widgetId,
    title,
    position: { x: 0, y: 0, width: 1, height: 1 },
    tabs: tabs || [],
    floating: false,
    pinned: false,
    collapsed: false,
    minimized: false,
  }
}

// ── Helpers ──

export function cloneWorkspaceLayout(layout: WorkspaceLayout): WorkspaceLayout {
  return JSON.parse(JSON.stringify(layout))
}

export function clonePanel(panel: Panel): Panel {
  return JSON.parse(JSON.stringify(panel))
}

export function getPanelById(layout: WorkspaceLayout, panelId: PanelId): Panel | undefined {
  return layout.panels.find(p => p.id === panelId)
}

export function addPanel(layout: WorkspaceLayout, panel: Panel): void {
  layout.panels.push(panel)
}

export function removePanel(layout: WorkspaceLayout, panelId: PanelId): void {
  const idx = layout.panels.findIndex(p => p.id === panelId)
  if (idx !== -1) {
    layout.panels.splice(idx, 1)
  }
}

export function updatePanelPosition(layout: WorkspaceLayout, panelId: PanelId, x: number, y: number, width: number, height: number): void {
  const panel = getPanelById(layout, panelId)
  if (panel) {
    panel.position = { x, y, width, height }
  }
}

export function reorderPanels(layout: WorkspaceLayout, newOrder: PanelId[]): void {
  const map = new Map<PanelId, Panel>()
  for (const p of layout.panels) map.set(p.id, p)
  layout.panels = newOrder.map(id => map.get(id)).filter(Boolean) as Panel[]
}
