/**
 * types.ts — Core types for Dockable Workspace Layout Engine
 *
 * @since 3.2.0
 */

/** Unique panel identifier */
export type PanelId = string

/** Unique layout identifier */
export type LayoutId = string

/** Widget identifier (refers to a registered WidgetDefinition.id) */
export type WidgetRef = string

// ── Grid Positioning ──

export interface PanelPosition {
  x: number
  y: number
  width: number
  height: number
}

// ── Panel ──

/** Panel-scoped state (persists across layout switches) */
export interface PanelState {
  [key: string]: unknown
}

/** A tab inside a panel */
export interface TabSpec {
  id: string
  widgetId: WidgetRef
  title: string
  icon?: string
}

export interface Panel {
  id: PanelId
  /** Optional reference to a PanelDefinition.id (defaults to widgetId) */
  definition?: string
  widgetId: WidgetRef
  title: string
  position: PanelPosition
  tabs: TabSpec[]
  /** Active tab id */
  activeTab?: string
  /** Floating (detached) window */
  floating: boolean
  /** Pinned — cannot be closed */
  pinned: boolean
  /** Collapsed — header only */
  collapsed: boolean
  /** Minimized — hidden until restored */
  minimized: boolean
  /** Panel-scoped state (persists across layout switches) */
  state: Record<string, unknown>
}

// ── Layout ──

export interface WorkspaceLayout {
  id: LayoutId
  name: string
  description?: string
  panels: Panel[]
  /** Schema version for migration */
  version: number
}

export const LAYOUT_VERSION = 1

// ── Persistence ──

export interface WorkspacePersistenceState {
  layouts: Record<LayoutId, WorkspaceLayout>
  activeLayout: LayoutId
  theme: string
  /** Sidebar pinned state */
  sidebarPinned: boolean
  version: number
}

export const PERSISTENCE_VERSION = 1

// ── Panel Container (Runtime) ──

export interface PanelContainer {
  panel: Panel
  /** Rendering status */
  mounted: boolean
  /** Widget React component resolved at runtime */
  component?: unknown
}
