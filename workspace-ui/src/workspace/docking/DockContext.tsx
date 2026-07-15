/**
 * DockContext — React context for Dock Manager
 *
 * Provides DockController to the React tree.
 *
 * @since 3.2.3
 */

import { createContext, useContext } from 'react'
import type { DockController } from './DockController'

const DockControllerContext = createContext<DockController | null>(null)

export interface DockContextProviderProps {
  controller: DockController
  children: React.ReactNode
}

export function DockContextProvider({ controller, children }: DockContextProviderProps): React.ReactElement {
  return (
    <DockControllerContext.Provider value={controller}>
      {children}
    </DockControllerContext.Provider>
  )
}

/** Hook to access DockController */
export function useDockController(): DockController {
  const ctx = useContext(DockControllerContext)
  if (!ctx) {
    throw new Error('useDockController must be used within a DockContextProvider')
  }
  return ctx
}
