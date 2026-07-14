import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { globalCommandRegistry, CommandRegistry } from './CommandRegistry'
import type { Command, CommandLogEntry } from './types'
import { Telemetry } from '../telemetry'

// ── Context ─────────────────────────────────────────────────────────

interface CommandContextValue {
  registry: CommandRegistry
  paletteOpen: boolean
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
  query: string
  setQuery: (q: string) => void
  results: Command[]
  execute: (id: string, params?: Record<string, unknown>) => Promise<void>
  history: CommandLogEntry[]
}

const CommandContext = createContext<CommandContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────

export function CommandProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Command[]>([])
  const [history, setHistory] = useState<CommandLogEntry[]>([])

  // Subscribe to history changes
  useEffect(() => {
    const unsub = globalCommandRegistry.onHistoryChange(setHistory)
    setHistory(globalCommandRegistry.getHistory())
    return unsub
  }, [])

  // Search on query change
  useEffect(() => {
    const res = globalCommandRegistry.search(query)
    setResults(res)
  }, [query])

  const openPalette = useCallback(() => {
    setPaletteOpen(true)
    setQuery('')
    setResults(globalCommandRegistry.search(''))
  }, [])

  const closePalette = useCallback(() => {
    setPaletteOpen(false)
    setQuery('')
  }, [])

  const togglePalette = useCallback(() => {
    setPaletteOpen((prev) => {
      if (!prev) {
        setQuery('')
        setResults(globalCommandRegistry.search(''))
      }
      return !prev
    })
  }, [])

  const execute = useCallback(
    async (id: string, params?: Record<string, unknown>) => {
      Telemetry.commandExecuted(id)
      await globalCommandRegistry.execute(id, params)
      closePalette()
    },
    [closePalette],
  )

  return (
    <CommandContext.Provider
      value={{
        registry: globalCommandRegistry,
        paletteOpen,
        openPalette,
        closePalette,
        togglePalette,
        query,
        setQuery,
        results,
        execute,
        history,
      }}
    >
      {children}
    </CommandContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────

export function useCommands(): CommandContextValue {
  const ctx = useContext(CommandContext)
  if (!ctx) throw new Error('useCommands must be used within a CommandProvider')
  return ctx
}
