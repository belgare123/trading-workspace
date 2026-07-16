/**
 * StrategyPanel.tsx — Thin React host for StrategyRuntime
 *
 * Thin wrapper that displays a strategy's graph and status.
 * No business logic — pure view layer.
 *
 * @since 3.7.2
 */

import { useEffect, useState, useRef, type ReactNode } from 'react'
import { GraphRuntime } from '../../strategy/composition/runtime/GraphRuntime'
import { StrategyGraph } from '../../strategy/composition/graph/StrategyGraph'
import type { StrategyGraph as StrategyGraphData } from '../../strategy/composition/types'

export interface StrategyPanelProps {
  /** Graph data to load (optional — defaults to empty graph) */
  graph?: StrategyGraphData
}

/**
 * StrategyPanel — thin React host for GraphRuntime.
 * Displays graph status and key metrics.
 */
export function StrategyPanel({ graph }: StrategyPanelProps): ReactNode {
  const runtimeRef = useRef(new GraphRuntime())
  const [status, setStatus] = useState<string>('idle')

  useEffect(() => {
    if (!graph) return
    const strategyGraph = new StrategyGraph(graph)
    const result = runtimeRef.current.load(strategyGraph)
    setStatus(result.success ? 'loaded' : 'error')
    return () => {
      runtimeRef.current.unload()
      setStatus('idle')
    }
  }, [graph])

  return (
    <div style={{
      padding: 16,
      color: '#c9d1d9',
      fontFamily: 'monospace',
      fontSize: 13,
      height: '100%',
      background: '#0d1117',
      overflow: 'auto',
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#58a6ff' }}>
        Strategy Graph
      </div>
      <div style={{ marginBottom: 8 }}>
        Status: <span style={{
          color: status === 'loaded' ? '#3fb950' : status === 'error' ? '#f85149' : '#8b949e',
        }}>
          {status}
        </span>
      </div>
      {graph && (
        <div>
          <div style={{ color: '#8b949e', fontSize: 11 }}>Graph: {graph.name}</div>
          <div style={{ color: '#8b949e', fontSize: 11 }}>Nodes: {graph.nodes.length} | Edges: {graph.edges.length}</div>
        </div>
      )}
    </div>
  )
}
