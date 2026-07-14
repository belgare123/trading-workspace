import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { globalLayoutRegistry, LayoutRegistry } from './LayoutRegistry'
import type { WorkspaceLayout } from './types'
import { useStore } from '../store'
import { Telemetry } from '../telemetry'

// ── Context ─────────────────────────────────────────────────────────

interface LayoutContextValue {
  registry: LayoutRegistry
  layouts: WorkspaceLayout[]
  activeLayout: WorkspaceLayout | undefined
  activeId: string | null
  switchLayout: (id: string) => void
  createLayout: (name: string, baseId?: string) => WorkspaceLayout
  duplicateLayout: (id: string, newName: string) => WorkspaceLayout
  updateLayout: (id: string, patch: Partial<WorkspaceLayout>) => void
  deleteLayout: (id: string) => void
  resetLayouts: () => void
  exportLayout: (id: string) => string
  importLayout: (json: string) => WorkspaceLayout
  requestAutoSave: () => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layouts, setLayouts] = useState<WorkspaceLayout[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Initialize registry
  useEffect(() => {
    globalLayoutRegistry.init()

    // Initial state
    setLayouts(globalLayoutRegistry.getAll())
    setActiveId(globalLayoutRegistry.getActiveId())

    // Subscribe to changes
    const unsub = globalLayoutRegistry.onChange((updated, active) => {
      setLayouts(updated)
      setActiveId(active)
    })

    return unsub
  }, [])

  // Apply layout to store when active layout changes
  useEffect(() => {
    const active = globalLayoutRegistry.getActive()
    if (!active) return

    useStore.getState().setActiveView(active.views.active)
    // Apply panel states
    if (useStore.getState().rightPanelOpen !== active.panels.inspector) {
      // Toggle if needed — but we don't have setter for rightPanelOpen directly
    }
    if (useStore.getState().timelineOpen !== active.panels.timeline) {
      useStore.getState().toggleTimeline()
    }

    // Note: sizes would be applied via a CSS variable mechanism in a real app
  }, [activeId])

  const switchLayout = useCallback((id: string) => {
    Telemetry.layoutChanged(id)
    globalLayoutRegistry.activate(id)
  }, [])

  const createLayout = useCallback((name: string, baseId?: string) => {
    Telemetry.layoutCreated(name, baseId)
    return globalLayoutRegistry.create(name, baseId)
  }, [])

  const duplicateLayout = useCallback((id: string, newName: string) => {
    Telemetry.layoutCreated(newName, id)
    return globalLayoutRegistry.duplicate(id, newName)
  }, [])

  const deleteLayout = useCallback((id: string) => {
    Telemetry.layoutDeleted(id)
    globalLayoutRegistry.delete(id)
  }, [])

  const updateLayout = useCallback((id: string, patch: Partial<WorkspaceLayout>) => {
    globalLayoutRegistry.update(id, patch)
  }, [])

  const resetLayouts = useCallback(() => {
    globalLayoutRegistry.resetToDefaults()
  }, [])

  const exportLayout = useCallback((id: string) => {
    return globalLayoutRegistry.exportLayout(id)
  }, [])

  const importLayout = useCallback((json: string) => {
    return globalLayoutRegistry.importLayout(json)
  }, [])

  const requestAutoSave = useCallback(() => {
    const state = useStore.getState()
    globalLayoutRegistry.autoSave({
      views: {
        active: state.activeView,
        opened: [state.activeView], // simplified; real app would track opened views
      },
      panels: {
        inspector: state.rightPanelOpen,
        timeline: state.timelineOpen,
        sidebar: true,
      },
      sizes: {
        sidebar: 220,
        inspector: 380,
        timeline: 140,
      },
      preferences: {
        theme: 'dark' as const,
        density: 'comfortable' as const,
      },
    })
  }, [])

  return (
    <LayoutContext.Provider
      value={{
        registry: globalLayoutRegistry,
        layouts,
        activeLayout: layouts.find((l) => l.id === activeId),
        activeId,
        switchLayout,
        createLayout,
        duplicateLayout,
        updateLayout,
        deleteLayout,
        resetLayouts,
        exportLayout,
        importLayout,
        requestAutoSave,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────

export function useLayouts(): LayoutContextValue {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayouts must be used within a LayoutProvider')
  return ctx
}
