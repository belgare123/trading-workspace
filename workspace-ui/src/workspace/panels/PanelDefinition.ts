/**
 * PanelDefinition — contract for a panel type
 *
 * A PanelDefinition describes how a panel looks and behaves.
 * Multiple panel instances can share one definition (via widgetId).
 *
 * @since 3.2.2
 */

import type { PanelId, Panel, PanelState } from '../layout/types'
import type { ReactNode } from 'react'

// ── Size ──

export interface Size {
  width: number
  height: number
}

// ── PanelAction ──

export type PanelActionId = 'close' | 'float' | 'pin' | 'collapse' | 'minimize' | 'maximize' | 'split' | 'rename'

// ── PanelContext (facade — does NOT expose LayoutEngine) ──

export interface PanelContext {
  /** The current runtime panel */
  panel: Panel
  /** Read-only layout metadata */
  layout: {
    id: string
    name: string
  }
  /** Panel-scoped state (persisted across layout switches) */
  state: PanelState
  /** Set panel state key */
  setState: (key: string, value: unknown) => void
  /** Panel actions — safe facade over LayoutEngine operations */
  actions: PanelActions
}

export interface PanelActions {
  close: () => void
  float: () => void
  pin: () => void
  collapse: () => void
  minimize: () => void
  maximize: () => void
  split: (direction: 'left' | 'right' | 'top' | 'bottom', widgetId: string, title: string) => void
  move: (x: number, y: number, width: number, height: number) => void
  rename: (title: string) => void
}

// ── PanelDefinition ──

export interface PanelDefinition {
  /** Unique id (e.g. 'chart', 'order-book', 'market-scanner') */
  id: string
  /** Widget id this panel renders by default */
  widgetId: string
  /** Display title */
  title: string
  /** Optional icon */
  icon?: string

  /** Default panel size (normalized 0..1) */
  defaultSize: Size
  /** Minimum panel size */
  minSize: Size
  /** Maximum panel size (optional) */
  maxSize?: Size

  /** Whether this panel starts floating */
  floating?: boolean

  /** Custom render function for panel content */
  render: (ctx: PanelContext) => ReactNode
}
