import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { globalRuntime, type RealtimeRuntime } from './RealtimeRuntime'

// ── Context ─────────────────────────────────────────────────────────

const RealtimeContext = createContext<RealtimeRuntime>(globalRuntime)

// ── Provider ────────────────────────────────────────────────────────

/**
 * Provides the global RealtimeRuntime singleton to all descendants.
 * On unmount, destroys all connections.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    return () => {
      globalRuntime.destroy()
    }
  }, [])

  return (
    <RealtimeContext.Provider value={globalRuntime}>
      {children}
    </RealtimeContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────

export function useRealtimeRuntime(): RealtimeRuntime {
  return useContext(RealtimeContext)
}
