/**
 * ChartHost.tsx — React component that hosts a ChartRuntime
 *
 * Creates a ChartRuntime instance, provides it via context,
 * and renders the chart surface (canvas / SVG container).
 *
 * The host manages:
 *   - Runtime lifecycle (create on mount, destroy on unmount)
 *   - Resize observer for the container
 *   - Delegation of pointer events to the runtime
 *
 * @since 3.3.1
 */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { ChartRuntime } from './ChartRuntime'
import { ChartRuntimeContext } from './ChartContext'
import { chartRegistry } from './ChartRegistry'
import type { ChartConfig } from '../types'

export interface ChartHostProps {
  config: ChartConfig
  children?: ReactNode
  /** Optional callback when runtime is created */
  onRuntimeReady?: (runtime: ChartRuntime) => void
}

/**
 * ChartHost — React component that hosts a ChartRuntime.
 *
 * Creates the runtime on mount, provides it via context,
 * and destroys it on unmount.
 *
 * The actual chart rendering (canvas/SVG) is done by child components
 * that consume the runtime via useChartRuntime().
 */
export function ChartHost({ config, children, onRuntimeReady }: ChartHostProps) {
  // Runtime is created once and lives for the component's lifetime.
  // We use a ref to avoid re-creating on re-renders.
  const runtimeRef = useRef<ChartRuntime | null>(null)

  if (!runtimeRef.current) {
    runtimeRef.current = new ChartRuntime(config)
    runtimeRef.current.initialize()
    onRuntimeReady?.(runtimeRef.current)
  }

  // Sync config on re-render (config may change from parent)
  useEffect(() => {
    const r = runtimeRef.current
    if (!r) return
    r.config = { ...config }
    r.viewport = { ...config.viewport }
    r.timeScale = { ...config.timeScale }
    r.priceScale = { ...config.priceScale }
    chartRegistry.updateConfig(r.id, config)
  }, [config])

  // Cleanup on unmount
  useEffect(() => {
    const r = runtimeRef.current
    return () => {
      r?.destroy()
      runtimeRef.current = null
    }
  }, [])

  return (
    <ChartRuntimeContext.Provider value={runtimeRef.current}>
      {children}
    </ChartRuntimeContext.Provider>
  )
}

// ── Re-exports for convenience ──

export { ChartRuntimeContext, useChartRuntime, useChartRuntimeOrThrow } from './ChartContext'
