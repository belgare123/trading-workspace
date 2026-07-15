/**
 * WorkspaceServicesProvider — React context + provider for workspace services
 *
 * Usage:
 *   <WorkspaceServicesProvider>
 *     <App />
 *   </WorkspaceServicesProvider>
 *
 * Provides:
 *   - Module-level singleton WorkspaceServices via React context
 *   - Global keyboard bindings via useKeyboardBinding
 *
 * @since 3.2.4
 */

import { createContext, useContext, type ReactNode } from 'react'
import { layoutEngine } from '../layout/LayoutEngine'
import { WorkspaceServices } from './WorkspaceServices'
import { useKeyboardBinding } from './useKeyboardBinding'

// ── Module-level singleton (eager initialization) ──

/**
 * Global workspace services instance.
 * Created eagerly at module load — UndoManager, CommandRegistry,
 * and SerializerService are available immediately without React.
 */
export const workspaceServices = new WorkspaceServices(layoutEngine)

// ── React context ──

const WorkspaceServicesCtx = createContext<WorkspaceServices>(workspaceServices)

/**
 * Access workspace services from any React component.
 */
export function useWorkspaceServices(): WorkspaceServices {
  return useContext(WorkspaceServicesCtx)
}

// ── Provider ──

export interface WorkspaceServicesProviderProps {
  children: ReactNode
}

/**
 * Provider that makes workspace services available via context
 * and attaches global keyboard bindings.
 */
export function WorkspaceServicesProvider({
  children,
}: WorkspaceServicesProviderProps) {
  useKeyboardBinding(workspaceServices.commandRegistry)

  return (
    <WorkspaceServicesCtx.Provider value={workspaceServices}>
      {children}
    </WorkspaceServicesCtx.Provider>
  )
}
