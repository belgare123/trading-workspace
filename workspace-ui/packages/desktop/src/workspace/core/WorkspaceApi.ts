/**
 * WorkspaceApi.ts — 2.0.x Workspace API.
 *
 * Unified public surface for the workspace platform.
 * Panels and plugins never access stores or registries directly —
 * they interact through this API. This enables swapping implementation
 * internals without touching consumers.
 *
 * Usage from a panel:
 *   import { workspace } from '../workspace/core'
 *   workspace.panels.open('chart')
 *   workspace.commands.execute('workspace.open.chart')
 */

import type { WorkspaceApi, DockZone, PanelCategory, PanelDefinition } from './types'
import { PanelRegistry } from './PanelRegistry'
import { createCommandRegistry } from './CommandRegistry'
import { createWorkspaceEventBus } from './EventBus'
import { ServiceRegistry } from './ServiceRegistry'
import { CapabilityRegistry } from './CapabilityRegistry'
import type { DockApi, LayoutServiceApi, Selection } from './types'
import {
  useWorkspaceStore,
  usePanelStore,
  useSelectionStore,
  useThemeStore,
  useCommandStore,
} from './store'

/**
 * Build the workspace API by wiring together all registries and stores.
 * Call this once during workspace initialization.
 */
export function createWorkspaceApi(
  dockApi: DockApi,
  layoutApi: LayoutServiceApi,
): WorkspaceApi {
  const eventBus = createWorkspaceEventBus()
  const commands = createCommandRegistry(null as unknown as WorkspaceApi) // placeholder

  const api: WorkspaceApi = {
    panels: {
      register(def: PanelDefinition) {
        PanelRegistry.register(def)
        // Auto-register default layout if specified
        if (def.defaultSize) {
          // Dock will handle this on first open
        }
      },

      get(id: string) {
        return PanelRegistry.get(id)
      },

      list() {
        return PanelRegistry.list()
      },

      listByCategory(cat: PanelCategory) {
        return PanelRegistry.listByCategory(cat)
      },

      open(id: string, zone?: DockZone) {
        dockApi.openPanel(id, zone)
        usePanelStore.getState().openPanel(id, zone)
        eventBus.emit('panel:opened', { panelId: id })
      },

      close(id: string) {
        dockApi.closePanel(id)
        usePanelStore.getState().closePanel(id)
        eventBus.emit('panel:closed', { panelId: id })
      },

      toggle(id: string) {
        dockApi.togglePanel(id)
        usePanelStore.getState().togglePanel(id)
      },

      isOpen(id: string) {
        return dockApi.isPanelOpen(id)
      },
    },

    dock: dockApi,

    layout: layoutApi,

    commands: commands,

    workspace: {
      get state() {
        return useWorkspaceStore.getState()
      },
      setFullscreen(v) {
        useWorkspaceStore.getState().setFullscreen(v)
      },
      toggleSidebar() {
        useWorkspaceStore.getState().toggleSidebar()
      },
      toggleStatusBar() {
        useWorkspaceStore.getState().toggleStatusBar()
      },
    },

    events: eventBus,

    services: ServiceRegistry,

    capabilities: CapabilityRegistry,

    theme: {
      get themeId() {
        return useThemeStore.getState().currentId
      },
      getTheme() {
        return useThemeStore.getState().getTheme()
      },
      setTheme(id: string) {
        useThemeStore.getState().setTheme(id)
        eventBus.emit('theme:changed', { themeId: id })
      },
      listThemes() {
        return useThemeStore.getState().listThemes()
      },
      registerTheme(t) {
        useThemeStore.getState().registerTheme(t)
      },
    },

    selection: {
      get(): Selection {
        return useSelectionStore.getState()
      },
      select(panelId: string) {
        useSelectionStore.getState().select(panelId)
        eventBus.emit('selection:changed', { panelId })
      },
      deselect(panelId: string) {
        useSelectionStore.getState().deselect(panelId)
      },
      clearSelection() {
        useSelectionStore.getState().clearSelection()
      },
      setContext(ctx) {
        useSelectionStore.getState().setContext(ctx)
      },
    },
  }

  // Rebuild command registry with the API bound
  const fullCommands = createCommandRegistry(api)

  // Patch panels.register to also register capabilities
  const originalRegister = api.panels.register
  api.panels.register = function (def: PanelDefinition) {
    originalRegister(def)
    // Auto-register command for opening this panel
    fullCommands.register({
      id: `workspace.open.${def.id}`,
      title: `Open ${def.title}`,
      category: 'Panels',
      icon: def.icon,
      handler: () => api.panels.open(def.id),
    })
  }

  api.commands = fullCommands

  return api
}

/**
 * Register the built-in workspace commands (static commands
 * that don't depend on specific panels).
 */
export function registerBuiltinCommands(api: WorkspaceApi): void {
  api.commands.register({
    id: 'workspace.command-palette.toggle',
    title: 'Command Palette',
    shortcut: 'Ctrl+K',
    category: 'Workspace',
    handler: () => useCommandStore.getState().togglePalette(),
  })

  api.commands.register({
    id: 'workspace.fullscreen.toggle',
    title: 'Toggle Fullscreen',
    shortcut: 'F11',
    category: 'Workspace',
    handler: () => api.workspace.setFullscreen(!api.workspace.state.fullscreen),
  })

  api.commands.register({
    id: 'workspace.sidebar.toggle',
    title: 'Toggle Sidebar',
    shortcut: 'Ctrl+B',
    category: 'Workspace',
    handler: () => api.workspace.toggleSidebar(),
  })

  api.commands.register({
    id: 'workspace.statusbar.toggle',
    title: 'Toggle Status Bar',
    category: 'Workspace',
    handler: () => api.workspace.toggleStatusBar(),
  })

  api.commands.register({
    id: 'workspace.layout.reset',
    title: 'Reset Layout',
    category: 'Layout',
    handler: () => api.layout.resetToDefault(),
  })

  api.commands.register({
    id: 'workspace.layout.save',
    title: 'Save Layout',
    category: 'Layout',
    handler: () => {
      const name = prompt('Layout name:')
      if (name) api.layout.saveLayout(name)
    },
  })
}