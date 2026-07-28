/**
 * workspace/core/index.ts — Barrel exports for Workspace Core.
 *
 * Import everything from a single path:
 *   import { PanelRegistry, createDockManager, useWorkspaceStore, ... } from '../workspace/core'
 */

// ── Types ─────────────────────────────────────────────
export type {
  PanelCategory,
  PanelCapability,
  PanelSize,
  PanelDefinition,
  DockZone,
  DockApi,
  LayoutSnapshot,
  LayoutPreset,
  LayoutServiceApi,
  Command,
  CommandContext,
  CommandRegistryApi,
  WorkspaceEventType,
  WorkspaceEvent,
  EventUnsubscribe,
  WorkspaceEventBus,
  ServiceDefinition,
  Service,
  ServiceRegistryApi,
  PanelCapabilityEntry,
  CapabilityRegistryApi,
  Selection,
  ThemeDefinition,
  ThemeColors,
  ThemeStoreApi,
  WorkspaceState,
  WorkspaceApi,
} from './types'

// ── Panel Registry ────────────────────────────────────
export { PanelRegistry } from './PanelRegistry'
export type { PanelRegistryApi } from './PanelRegistry'

// ── Command Registry ──────────────────────────────────
export { createCommandRegistry, _resetCommands } from './CommandRegistry'

// ── Event Bus ─────────────────────────────────────────
export { createWorkspaceEventBus } from './EventBus'

// ── Service Registry ──────────────────────────────────
export { ServiceRegistry } from './ServiceRegistry'

// ── Capability Registry ───────────────────────────────
export { CapabilityRegistry } from './CapabilityRegistry'

// ── Dock Manager ──────────────────────────────────────
export {
  createDockManager,
  createFactory,
  buildDefaultLayoutJson,
} from './DockManager'

// ── Layout Service ────────────────────────────────────
export { createLayoutService } from './LayoutService'

// ── Workspace API ─────────────────────────────────────
export { createWorkspaceApi, registerBuiltinCommands } from './WorkspaceApi'

// ── Zustand Stores ────────────────────────────────────
export {
  useWorkspaceStore,
  useLayoutStore,
  usePanelStore,
  useCommandStore,
  useSelectionStore,
  useThemeStore,
} from './store'

export type { LayoutRecord } from './store'
