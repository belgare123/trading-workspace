import { create } from 'zustand'
import type { ScannerItem, Opportunity, SystemMetric, ReplayState, SystemMetrics, HealthData } from '../types'

interface WorkspaceState {
  // Navigation
  activeView: string
  setActiveView: (view: string) => void

  // Scanner
  scannerItems: ScannerItem[]
  setScannerItems: (items: ScannerItem[]) => void

  // Opportunities
  opportunities: Opportunity[]
  addOpportunity: (op: Opportunity) => void

  // System
  metrics: SystemMetric[]
  setMetrics: (metrics: SystemMetric[]) => void

  // System Overview (aggregated, from backend)
  systemMetrics: SystemMetrics
  setSystemMetrics: (m: Partial<SystemMetrics>) => void
  health: HealthData
  setHealth: (h: Partial<HealthData>) => void

  // Replay
  replay: ReplayState
  setReplay: (state: Partial<ReplayState>) => void

  // Panel
  rightPanelOpen: boolean
  toggleRightPanel: () => void

  // Timeline
  timelineOpen: boolean
  toggleTimeline: () => void

  // Dashboard Preset
  dashboardPreset: string
  setDashboardPreset: (preset: string) => void

  // Widget Grid Layouts (key = widgetId, value = { colSpan, rowSpan })
  widgetGridLayouts: Record<string, { colSpan: number; rowSpan: number }>
  setWidgetLayout: (widgetId: string, colSpan: number, rowSpan: number) => void
  swapWidgetLayouts: (idA: string, idB: string) => void
}

const defaultSystemMetrics: SystemMetrics = {
  runtime: 98,
  pnl: 12451,
  signals: 42,
  events: 2400000,
  cpu: 18,
  memory: 1.2,
  ws_clients: 26,
  connected: true,
}

const defaultHealth: HealthData = {
  overall_score: 87,
  status: 'healthy',
  components: [],
}

export const useStore = create<WorkspaceState>((set) => ({
  activeView: 'scanner',
  setActiveView: (view) => set({ activeView: view }),

  scannerItems: [],
  setScannerItems: (items) => set({ scannerItems: items }),

  opportunities: [],
  addOpportunity: (op) =>
    set((state) => ({ opportunities: [op, ...state.opportunities].slice(0, 100) })),

  metrics: [],
  setMetrics: (metrics) => set({ metrics }),

  systemMetrics: defaultSystemMetrics,
  setSystemMetrics: (m) => set((s) => ({ systemMetrics: { ...s.systemMetrics, ...m } })),
  health: defaultHealth,
  setHealth: (h) => set((s) => ({ health: { ...s.health, ...h } })),

  replay: { status: 'idle', speed: 1, currentTime: 0, totalTime: 0, bookmarks: [] },
  setReplay: (partial) =>
    set((state) => ({ replay: { ...state.replay, ...partial } })),

  rightPanelOpen: true,
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

  timelineOpen: false,
  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),

  dashboardPreset: 'default',
  setDashboardPreset: (preset) => set({ dashboardPreset: preset }),

  widgetGridLayouts: {},
  setWidgetLayout: (widgetId, colSpan, rowSpan) =>
    set((s) => ({
      widgetGridLayouts: { ...s.widgetGridLayouts, [widgetId]: { colSpan, rowSpan } },
    })),
  swapWidgetLayouts: (idA, idB) =>
    set((s) => {
      const a = s.widgetGridLayouts[idA];
      const b = s.widgetGridLayouts[idB];
      return {
        widgetGridLayouts: {
          ...s.widgetGridLayouts,
          [idA]: b ?? a,
          [idB]: a ?? b,
        },
      };
    }),
}))
