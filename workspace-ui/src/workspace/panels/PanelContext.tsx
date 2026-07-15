/**
 * PanelContext.tsx — React context providing PanelRuntime to the component tree
 *
 * Usage:
 *   <PanelContextProvider runtime={runtime}>
 *     <PanelHost />
 *   </PanelContextProvider>
 *
 * @since 3.2.2
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { PanelRuntime } from './PanelRuntime'

const PanelRuntimeContext = createContext<PanelRuntime | null>(null)

export interface PanelContextProviderProps {
  runtime: PanelRuntime
  children: ReactNode
}

export function PanelContextProvider({ runtime, children }: PanelContextProviderProps): ReactNode {
  return (
    <PanelRuntimeContext.Provider value={runtime}>
      {children}
    </PanelRuntimeContext.Provider>
  )
}

/**
 * Hook to access the PanelRuntime from any component
 */
export function usePanelRuntime(): PanelRuntime {
  const ctx = useContext(PanelRuntimeContext)
  if (!ctx) {
    throw new Error('usePanelRuntime must be used within a PanelContextProvider')
  }
  return ctx
}
