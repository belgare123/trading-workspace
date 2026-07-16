/**
 * ChartContext.tsx — React context for ChartRuntime
 *
 * Provides a ChartRuntime instance to all children of ChartHost.
 * Components can use useChartRuntime() to access the runtime
 * without prop drilling.
 *
 * @since 3.3.1
 */

import { createContext, useContext } from 'react'
import type { ChartRuntime } from './ChartRuntime'

const ChartRuntimeContext = createContext<ChartRuntime | null>(null)

/**
 * Access the current chart runtime from within a chart component hierarchy.
 * Returns null if used outside of a ChartHost.
 */
export function useChartRuntime(): ChartRuntime | null {
  return useContext(ChartRuntimeContext)
}

/**
 * Access the current chart runtime — non-nullable version.
 * Throws if used outside of a ChartHost.
 */
export function useChartRuntimeOrThrow(): ChartRuntime {
  const ctx = useContext(ChartRuntimeContext)
  if (!ctx) {
    throw new Error('useChartRuntimeOrThrow must be used inside a <ChartHost>')
  }
  return ctx
}

export { ChartRuntimeContext }
