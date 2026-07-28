/**
 * stores — 2.0.4 Workspace Stores (Zustand).
 *
 * Small, independent stores for different concerns.
 * Each store is minimal and focused. No monolithic store.
 */

import { create } from 'zustand'
import type { WorkspaceState, Selection, ThemeDefinition, DockZone } from '../types'

// ── WorkspaceStore — global workspace state ───────────

interface WorkspaceStoreData extends WorkspaceState {
  setReady: () => void
  setFullscreen: (v: boolean) => void
  toggleSidebar: () => void
  toggleStatusBar: () => void
}

export const useWorkspaceStore = create<WorkspaceStoreData>((set) => ({
  ready: false,
  fullscreen: false,
  sidebarVisible: true,
  statusBarVisible: true,

  setReady: () => set({ ready: true }),
  setFullscreen: (v) => set({ fullscreen: v }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleStatusBar: () => set((s) => ({ statusBarVisible: !s.statusBarVisible })),
}))

// ── LayoutStore — saved layout presets ────────────────

export interface LayoutRecord {
  name: string
  modelJson: unknown
  updatedAt: string
}

interface LayoutStoreData {
  layouts: Record<string, LayoutRecord>
  activeLayout: string | null
  saveLayout: (name: string, modelJson: unknown) => void
  loadLayout: (name: string) => LayoutRecord | undefined
  deleteLayout: (name: string) => void
  listLayouts: () => string[]
  setActiveLayout: (name: string | null) => void
}

export const useLayoutStore = create<LayoutStoreData>((set, get) => ({
  layouts: {},
  activeLayout: null,

  saveLayout: (name, modelJson) =>
    set((s) => ({
      layouts: {
        ...s.layouts,
        [name]: { name, modelJson, updatedAt: new Date().toISOString() },
      },
    })),

  loadLayout: (name) => get().layouts[name],
  deleteLayout: (name) =>
    set((s) => {
      const { [name]: _, ...rest } = s.layouts
      return { layouts: rest }
    }),

  listLayouts: () => Object.keys(get().layouts),
  setActiveLayout: (name) => set({ activeLayout: name }),
}))

// ── PanelStore — runtime panel state (open/closed/active) ──

interface PanelState {
  id: string
  open: boolean
  zone?: DockZone
}

interface PanelStoreData {
  panels: Record<string, PanelState>
  activePanel: string | null
  openPanel: (id: string, zone?: DockZone) => void
  closePanel: (id: string) => void
  togglePanel: (id: string) => void
  activatePanel: (id: string | null) => void
  isOpen: (id: string) => boolean
  openPanelIds: () => string[]
}

export const usePanelStore = create<PanelStoreData>((set, get) => ({
  panels: {},
  activePanel: null,

  openPanel: (id, zone) =>
    set((s) => ({
      panels: { ...s.panels, [id]: { id, open: true, zone } },
      activePanel: id,
    })),

  closePanel: (id) =>
    set((s) => {
      const { [id]: removed, ...rest } = s.panels
      return {
        panels: rest,
        activePanel: s.activePanel === id ? null : s.activePanel,
      }
    }),

  togglePanel: (id) => {
    const current = get().panels[id]
    if (current?.open) {
      get().closePanel(id)
    } else {
      get().openPanel(id)
    }
  },

  activatePanel: (id) => set({ activePanel: id }),

  isOpen: (id) => get().panels[id]?.open ?? false,

  openPanelIds: () =>
    Object.values(get().panels)
      .filter((p) => p.open)
      .map((p) => p.id),
}))

// ── CommandStore — ephemeral command execution state ──

interface CommandStoreData {
  /** Recently executed command IDs for palette history */
  history: string[]
  /** Whether palette is open */
  paletteOpen: boolean
  pushHistory: (commandId: string) => void
  setPaletteOpen: (open: boolean) => void
  togglePalette: () => void
}

export const useCommandStore = create<CommandStoreData>((set) => ({
  history: [],
  paletteOpen: false,

  pushHistory: (commandId) =>
    set((s) => ({
      history: [commandId, ...s.history.filter((id) => id !== commandId)].slice(0, 20),
    })),

  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
}))

// ── SelectionStore — UI selection state ───────────────

interface SelectionStoreData extends Selection {
  select: (panelId: string) => void
  deselect: (panelId: string) => void
  clearSelection: () => void
  setContext: (ctx: Record<string, unknown>) => void
}

export const useSelectionStore = create<SelectionStoreData>((set) => ({
  panels: [],
  activePanel: null,
  context: {},

  select: (panelId) =>
    set((s) => ({
      panels: s.panels.includes(panelId) ? s.panels : [...s.panels, panelId],
      activePanel: panelId,
    })),

  deselect: (panelId) =>
    set((s) => ({
      panels: s.panels.filter((id) => id !== panelId),
      activePanel: s.activePanel === panelId ? null : s.activePanel,
    })),

  clearSelection: () => set({ panels: [], activePanel: null, context: {} }),
  setContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),
}))

// ── ThemeStore — theme state ──────────────────────────

const DARK_THEME: ThemeDefinition = {
  id: 'dark-terminal',
  name: 'Dark Terminal',
  colors: {
    bg: '#0b0e14',
    surface: '#151922',
    border: '#2d3748',
    accent: '#3b82f6',
    profit: '#22c55e',
    loss: '#ef4444',
    text: '#e2e8f0',
    textMuted: '#64748b',
  },
}

interface ThemeStoreData {
  currentId: string
  themes: Record<string, ThemeDefinition>
  getTheme: () => ThemeDefinition
  setTheme: (id: string) => void
  listThemes: () => ThemeDefinition[]
  registerTheme: (t: ThemeDefinition) => void
}

export const useThemeStore = create<ThemeStoreData>((set, get) => ({
  currentId: 'dark-terminal',
  themes: { 'dark-terminal': DARK_THEME },

  getTheme: () => get().themes[get().currentId] ?? DARK_THEME,
  setTheme: (id) => {
    if (get().themes[id]) {
      set({ currentId: id })
    }
  },
  listThemes: () => Object.values(get().themes),
  registerTheme: (t) =>
    set((s) => ({
      themes: { ...s.themes, [t.id]: t },
    })),
}))
