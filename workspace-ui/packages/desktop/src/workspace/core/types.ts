/**
 * types.ts — Core type definitions for Workspace Platform.
 *
 * All workspace modules share these types. Nothing in this file
 * has any runtime dependencies — it's pure TypeScript contracts.
 */

import type { ComponentType } from 'react'

// ── Panel System ─────────────────────────────────────

export type PanelCategory =
  | 'trading'
  | 'analysis'
  | 'data'
  | 'system'
  | 'ai'
  | 'replay'

export type PanelCapability =
  | 'chart'
  | 'trading'
  | 'replay'
  | 'analytics'
  | 'portfolio'
  | 'ai'
  | 'log'
  | 'orders'
  | 'positions'
  | 'signals'

export interface PanelSize {
  width: number
  height: number
}

export interface PanelDefinition {
  /** Unique identifier, e.g. "orders", "chart.btc" */
  id: string
  /** Human-readable title displayed on tab */
  title: string
  /** Icon identifier (emoji, lucide name, or URL) */
  icon: string
  /** Category grouping for sidebar / command palette */
  category: PanelCategory
  /** React component — will be rendered inside the dock tab */
  component: ComponentType<{ panelId: string }>
  /** Default dimensions when opened first time */
  defaultSize?: PanelSize
  /** Minimum dimensions */
  minSize?: PanelSize
  /** Panel version (for SDK / hot-reload) */
  version?: string
  /** Required permissions (future RBAC) */
  permissions?: string[]
  /** Lazy-load the component instead of eagerly bundling */
  lazy?: boolean
  /** Preferred default dock location */
  defaultZone?: DockZone
  /** Hot-reload tag — bump to force re-mount */
  hotReload?: number
  /** Origin plugin ID if panel is provided by a plugin */
  pluginOrigin?: string
}

// ── Dock System ───────────────────────────────────────

/** Logical dock zones — abstracted from FlexLayout */
export type DockZone = 'left' | 'right' | 'center' | 'bottom' | 'float'

export interface DockApi {
  /** Open a panel (creates tab or focuses existing) */
  openPanel(panelId: string, zone?: DockZone): void
  /** Close a panel tab */
  closePanel(panelId: string): void
  /** Toggle panel visibility */
  togglePanel(panelId: string): void
  /** Check if panel is currently open */
  isPanelOpen(panelId: string): boolean
  /** Split the active tabset and add a panel */
  splitPanel(panelId: string, direction: 'h' | 'v'): void
  /** Get the full snapshot of what's shown */
  getLayoutSnapshot(): LayoutSnapshot
}

export interface LayoutSnapshot {
  /** Currently open panel IDs in order */
  openPanels: string[]
  /** Active (focused) panel ID or null */
  activePanel: string | null
}

// ── Layout System ─────────────────────────────────────

export interface LayoutPreset {
  id: string
  name: string
  description?: string
  /** Serialized FlexLayout JSON model */
  modelJson: unknown
}

export interface LayoutServiceApi {
  /** Save current layout under a name */
  saveLayout(name: string): void
  /** Load a named layout */
  loadLayout(name: string): boolean
  /** Delete a saved layout */
  deleteLayout(name: string): void
  /** List all saved layout names */
  listLayouts(): string[]
  /** Get a named preset */
  getPreset(id: string): LayoutPreset | undefined
  /** List all built-in presets */
  listPresets(): LayoutPreset[]
  /** Reset layout to default */
  resetToDefault(): void
}

// ── Command System ────────────────────────────────────

export interface Command {
  /** Globally unique command ID, e.g. "workspace.open.chart" */
  id: string
  /** Human-readable title */
  title: string
  /** Keyboard shortcut (e.g. "Ctrl+1") */
  shortcut?: string
  /** Category for grouping in palette */
  category?: string
  /** Optional icon */
  icon?: string
  /** Execute handler — receives the command context */
  handler: (ctx: CommandContext) => void | Promise<void>
}

export interface CommandContext {
  /** The command ID being executed */
  commandId: string
  /** Workspace API available to commands */
  workspace: WorkspaceApi
}

export interface CommandRegistryApi {
  /** Register a command */
  register(command: Command): void
  /** Unregister a command */
  unregister(commandId: string): void
  /** Get command by ID */
  get(commandId: string): Command | undefined
  /** List all registered commands, optionally filtered by category */
  list(category?: string): Command[]
  /** Execute a command by ID */
  execute(commandId: string): Promise<void>
  /** Search commands by query (matches id, title, category) */
  search(query: string): Command[]
}

// ── Event System ──────────────────────────────────────

export type WorkspaceEventType =
  | 'panel:opened'
  | 'panel:closed'
  | 'panel:activated'
  | 'panel:resized'
  | 'layout:changed'
  | 'layout:saved'
  | 'layout:loaded'
  | 'command:executed'
  | 'theme:changed'
  | 'selection:changed'
  | 'workspace:ready'
  | 'workspace:before-close'

export interface WorkspaceEvent {
  type: WorkspaceEventType
  timestamp: number
  payload?: unknown
}

/** Unsubscribe function returned by EventBus.on() */
export type EventUnsubscribe = () => void

export interface WorkspaceEventBus {
  /** Subscribe to an event type. Returns unsubscribe function. */
  on(type: WorkspaceEventType, handler: (event: WorkspaceEvent) => void): EventUnsubscribe
  /** Subscribe to a single event, then auto-unsubscribe */
  once(type: WorkspaceEventType, handler: (event: WorkspaceEvent) => void): EventUnsubscribe
  /** Emit an event */
  emit(type: WorkspaceEventType, payload?: unknown): void
  /** Remove all listeners for a type (or all if type omitted) */
  clear(type?: WorkspaceEventType): void
}

// ── Service System ────────────────────────────────────

export interface ServiceDefinition {
  id: string
  title: string
  version?: string
  /** The service instance — must implement Service interface */
  instance: Service
}

export interface Service {
  /** Called during workspace initialization */
  init?(): void | Promise<void>
  /** Called during workspace teardown */
  destroy?(): void | Promise<void>
}

export interface ServiceRegistryApi {
  /** Register a service */
  register(def: ServiceDefinition): void
  /** Unregister a service */
  unregister(serviceId: string): void
  /** Get a service by ID */
  get<T extends Service>(serviceId: string): T | undefined
  /** List all registered services */
  list(): ServiceDefinition[]
  /** Initialize all registered services (ordered by registration) */
  initAll(): Promise<void>
  /** Destroy all services (ordered by reverse registration) */
  destroyAll(): Promise<void>
}

// ── Capability System ─────────────────────────────────

export interface PanelCapabilityEntry {
  panelId: string
  capabilities: PanelCapability[]
}

export interface CapabilityRegistryApi {
  /** Declare capabilities for a panel */
  register(panelId: string, capabilities: PanelCapability[]): void
  /** Update capabilities for a panel */
  update(panelId: string, capabilities: PanelCapability[]): void
  /** Remove capability declaration */
  unregister(panelId: string): void
  /** Find panels that have ALL the specified capabilities */
  findAll(capabilities: PanelCapability[]): string[]
  /** Find panels that have ANY of the specified capabilities */
  findAny(capabilities: PanelCapability[]): string[]
  /** Get capabilities for a specific panel */
  get(panelId: string): PanelCapability[] | undefined
  /** List all capability entries */
  list(): PanelCapabilityEntry[]
}

// ── Selection System ──────────────────────────────────

export interface Selection {
  /** Currently selected panel IDs */
  panels: string[]
  /** Currently active panel (last clicked / focused) */
  activePanel: string | null
  /** Selection metadata (e.g. selected trade IDs, time range) */
  context?: Record<string, unknown>
}

// ── Theme System ──────────────────────────────────────

export interface ThemeDefinition {
  id: string
  name: string
  colors: ThemeColors
}

export interface ThemeColors {
  bg: string
  surface: string
  border: string
  accent: string
  profit: string
  loss: string
  text: string
  textMuted: string
}

export interface ThemeStoreApi {
  /** Current theme ID */
  themeId: string
  /** Get current theme definition */
  getTheme(): ThemeDefinition
  /** Set theme by ID */
  setTheme(themeId: string): void
  /** List available themes */
  listThemes(): ThemeDefinition[]
  /** Register a new theme */
  registerTheme(theme: ThemeDefinition): void
}

// ── Workspace Store State ─────────────────────────────

export interface WorkspaceState {
  /** Whether workspace is fully initialized */
  ready: boolean
  /** Whether workspace is in fullscreen mode */
  fullscreen: boolean
  /** Whether sidebar is visible */
  sidebarVisible: boolean
  /** Whether status bar is visible */
  statusBarVisible: boolean
}

// ── Workspace API (unified public surface) ────────────

export interface WorkspaceApi {
  /** Panel operations */
  panels: {
    register(def: PanelDefinition): void
    get(id: string): PanelDefinition | undefined
    list(): PanelDefinition[]
    listByCategory(cat: PanelCategory): PanelDefinition[]
    /** Open panel in dock */
    open(id: string, zone?: DockZone): void
    /** Close panel in dock */
    close(id: string): void
    /** Toggle panel */
    toggle(id: string): void
    /** Check if panel is open */
    isOpen(id: string): boolean
  }

  /** Dock operations */
  dock: DockApi

  /** Layout operations */
  layout: LayoutServiceApi

  /** Command operations */
  commands: CommandRegistryApi

  /** Workspace-level state */
  workspace: {
    state: WorkspaceState
    setFullscreen(v: boolean): void
    toggleSidebar(): void
    toggleStatusBar(): void
  }

  /** Event bus */
  events: WorkspaceEventBus

  /** Service registry */
  services: ServiceRegistryApi

  /** Capability registry */
  capabilities: CapabilityRegistryApi

  /** Theme */
  theme: ThemeStoreApi

  /** Selection */
  selection: {
    get(): Selection
    select(panelId: string): void
    deselect(panelId: string): void
    clearSelection(): void
    setContext(ctx: Record<string, unknown>): void
  }
}
