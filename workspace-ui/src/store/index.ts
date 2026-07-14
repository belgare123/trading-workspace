import { create } from 'zustand'
import type { ScannerItem, Opportunity, SystemMetric, ReplayState } from '../types'

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

  // Replay
  replay: ReplayState
  setReplay: (state: Partial<ReplayState>) => void

  // Panel
  rightPanelOpen: boolean
  toggleRightPanel: () => void

  // Timeline
  timelineOpen: boolean
  toggleTimeline: () => void
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

  replay: { status: 'idle', speed: 1, currentTime: 0, totalTime: 0, bookmarks: [] },
  setReplay: (partial) =>
    set((state) => ({ replay: { ...state.replay, ...partial } })),

  rightPanelOpen: true,
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

  timelineOpen: false,
  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
}))
