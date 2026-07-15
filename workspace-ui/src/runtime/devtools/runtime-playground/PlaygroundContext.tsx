/**
 * PlaygroundContext — состояние Runtime Playground
 *
 * @since 2.0.0
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

/* ============================================================
 * Types
 * ============================================================ */

export type PanelId =
  | 'event-emitter'
  | 'service-console'
  | 'command-console'
  | 'plugin-sandbox'
  | 'capability-tester'
  | 'recorder-control'
  | 'state-explorer'
  | 'script-runner'

export type InspectorTab = 'console' | 'logs' | 'errors' | 'latency' | 'memory'
export type OutputTab = 'output' | 'events' | 'json' | 'timeline'
export type ConsoleLevel = 'info' | 'warn' | 'error' | 'success' | 'log'

export interface ConsoleEntry {
  id: string
  timestamp: number
  level: ConsoleLevel
  message: string
  data?: unknown
}

export interface PlaygroundState {
  activePanel: PanelId
  setActivePanel: (id: PanelId) => void

  activeInspectorTab: InspectorTab
  setActiveInspectorTab: (tab: InspectorTab) => void

  activeOutputTab: OutputTab
  setActiveOutputTab: (tab: OutputTab) => void

  activeTreeBranch: string | null
  setActiveTreeBranch: (branch: string | null) => void

  consoleEntries: ConsoleEntry[]
  addConsoleEntry: (entry: ConsoleEntry) => void
  clearConsole: () => void

  currentScript: string
  setCurrentScript: (script: string) => void
  scriptOutput: string[]
  addScriptOutput: (line: string) => void
  clearScriptOutput: () => void

  eventTopic: string
  setEventTopic: (topic: string) => void
  eventPayload: string
  setEventPayload: (payload: string) => void

  serviceCommand: string
  setServiceCommand: (cmd: string) => void
  serviceResult: string
  setServiceResult: (result: string) => void

  loadedPlugins: string[]
  setLoadedPlugins: (plugins: string[]) => void

  isRecording: boolean
  setIsRecording: (v: boolean) => void
}

/* ============================================================
 * Context
 * ============================================================ */

const PlaygroundContext = createContext<PlaygroundState | null>(null)

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelId>('event-emitter')
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('console')
  const [activeOutputTab, setActiveOutputTab] = useState<OutputTab>('output')
  const [activeTreeBranch, setActiveTreeBranch] = useState<string | null>('services')
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [currentScript, setCurrentScript] = useState('')
  const [scriptOutput, setScriptOutput] = useState<string[]>([])
  const [eventTopic, setEventTopic] = useState('market.tick')
  const [eventPayload, setEventPayload] = useState('{\n  "symbol": "BTCUSDT",\n  "price": 68500,\n  "volume": 1.42\n}')
  const [serviceCommand, setServiceCommand] = useState('')
  const [serviceResult, setServiceResult] = useState('')
  const [loadedPlugins, setLoadedPlugins] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)

  const addConsoleEntry = useCallback((entry: ConsoleEntry) => {
    setConsoleEntries((prev) => [entry, ...prev].slice(0, 200))
  }, [])

  const clearConsole = useCallback(() => setConsoleEntries([]), [])

  const addScriptOutput = useCallback((line: string) => {
    setScriptOutput((prev) => [...prev, line].slice(-100))
  }, [])

  const clearScriptOutput = useCallback(() => setScriptOutput([]), [])

  const value: PlaygroundState = {
    activePanel, setActivePanel,
    activeInspectorTab, setActiveInspectorTab,
    activeOutputTab, setActiveOutputTab,
    activeTreeBranch, setActiveTreeBranch,
    consoleEntries, addConsoleEntry, clearConsole,
    currentScript, setCurrentScript,
    scriptOutput, addScriptOutput, clearScriptOutput,
    eventTopic, setEventTopic,
    eventPayload, setEventPayload,
    serviceCommand, setServiceCommand,
    serviceResult, setServiceResult,
    loadedPlugins, setLoadedPlugins,
    isRecording, setIsRecording,
  }

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
    </PlaygroundContext.Provider>
  )
}

export function usePlayground(): PlaygroundState {
  const ctx = useContext(PlaygroundContext)
  if (!ctx) throw new Error('usePlayground must be used within PlaygroundProvider')
  return ctx
}
