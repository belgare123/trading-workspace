/**
 * PanelActions — action button definitions for panels
 *
 * Provides meta-information about each panel action
 * (label, icon, shortcut) for UI rendering.
 *
 * @since 3.2.2
 */

import type { PanelActionId } from './PanelDefinition'

export interface PanelActionMeta {
  id: PanelActionId
  label: string
  icon: string
  shortcut?: string
  /** Whether this action is destructive */
  destructive?: boolean
}

export const PANEL_ACTIONS: Record<PanelActionId, PanelActionMeta> = {
  close:       { id: 'close',     label: 'Close',       icon: '×',         shortcut: 'Ctrl+W',      destructive: true },
  float:       { id: 'float',     label: 'Float',       icon: '◇' },
  pin:         { id: 'pin',       label: 'Pin',         icon: '📌' },
  collapse:    { id: 'collapse',  label: 'Collapse',    icon: '−' },
  minimize:    { id: 'minimize',  label: 'Minimize',    icon: '_' },
  maximize:    { id: 'maximize',  label: 'Maximize',    icon: '⛶',       shortcut: 'Ctrl+Shift+M' },
  split:       { id: 'split',     label: 'Split',       icon: '⊞',        shortcut: 'Ctrl+\\' },
  rename:      { id: 'rename',    label: 'Rename',      icon: '✎' },
}

/** Filtered list of default visible actions */
export function getDefaultPanelActions(): PanelActionMeta[] {
  return [
    PANEL_ACTIONS.close,
    PANEL_ACTIONS.pin,
    PANEL_ACTIONS.float,
    PANEL_ACTIONS.collapse,
    PANEL_ACTIONS.minimize,
  ]
}
