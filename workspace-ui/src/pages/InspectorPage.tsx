import { useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery } from '@tanstack/react-query'
import { getInspector, getTrace } from '../api/inspector'
import { Card, CardHeader, Input, Button } from '../components/ui'
import type { TraceGraph } from '../types'

export function InspectorPage() {
  const [symbol, setSymbol] = useState('BTC/USDT')
  const [querySymbol, setQuerySymbol] = useState('BTCUSDT')

  const { data: inspect, isLoading: loadingInspect } = useQuery({
    queryKey: ['inspector', querySymbol],
    queryFn: () => getInspector(querySymbol.replace('/', '')),
    enabled: !!querySymbol,
    refetchInterval: 30_000,
  })

  const { data: trace, isLoading: loadingTrace } = useQuery({
    queryKey: ['trace', querySymbol],
    queryFn: () => getTrace(querySymbol.replace('/', '')),
    enabled: !!querySymbol,
  })

  const handleInspect = () => {
    setQuerySymbol(symbol)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header + Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-surface-50">Inspector</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Symbol (e.g. BTC/USDT)"
            className="w-48 font-mono"
            onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
          />
          <Button onClick={handleInspect}>Inspect</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Feature Cards Grid */}
        <Card>
          <CardHeader>
            <span className="font-semibold text-surface-50">Features</span>
            <span className="text-xs text-surface-600">
              {querySymbol} · auto-refresh 30s
            </span>
          </CardHeader>
          <div className="p-3">
            {loadingInspect ? (
              <div className="text-surface-600 text-sm py-8 text-center">Loading features...</div>
            ) : inspect ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(inspect.features).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-surface-800/50 rounded-lg p-3 border border-surface-700/50"
                    >
                      <div className="text-xs text-surface-600 mb-1">{key}</div>
                      <div className="text-sm font-mono text-surface-50">
                        {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Decision Chain */}
                <div className="mt-4">
                  <div className="text-xs text-surface-600 font-semibold mb-2 uppercase tracking-wider">
                    Decision Chain
                  </div>
                  <div className="space-y-1">
                    {inspect.decision_chain.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-surface-600 mt-0.5 shrink-0">→</span>
                        <span className="text-surface-300">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-surface-600 text-sm py-8 text-center">
                Enter a symbol and click Inspect
              </div>
            )}
          </div>
        </Card>

        {/* Trace Graph */}
        <Card>
          <CardHeader>
            <span className="font-semibold text-surface-50">Decision Trace</span>
            <span className="text-xs text-surface-600">Pipeline flow</span>
          </CardHeader>
          <div className="p-0" style={{ height: 420 }}>
            {loadingTrace ? (
              <div className="text-surface-600 text-sm py-16 text-center">Loading trace...</div>
            ) : trace ? (
              <TraceGraphView trace={trace} />
            ) : (
              <div className="text-surface-600 text-sm py-16 text-center">
                Inspect a symbol to see the trace
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function TraceGraphView({ trace }: { trace: TraceGraph }) {
  const nodes: Node[] = trace.nodes.map((n) => ({
    id: n.id,
    type: n.type === 'input' ? 'input' : n.type === 'output' ? 'output' : 'default',
    position: n.position,
    data: {
      label: (
        <div className="text-xs leading-tight">
          <div className="font-semibold text-surface-50">{n.data.label}</div>
          <div className="text-surface-500 mt-0.5" style={{ fontSize: 9 }}>{n.data.detail}</div>
        </div>
      ),
    },
    style: {
      background:
        n.data.status === 'ok'
          ? 'rgba(34, 197, 94, 0.12)'
          : n.data.status === 'warn'
          ? 'rgba(234, 179, 8, 0.12)'
          : 'rgba(239, 68, 68, 0.12)',
      border: `1px solid ${
        n.data.status === 'ok'
          ? 'rgba(34, 197, 94, 0.3)'
          : n.data.status === 'warn'
          ? 'rgba(234, 179, 8, 0.3)'
          : 'rgba(239, 68, 68, 0.3)'
      }`,
      borderRadius: 8,
      padding: '8px 12px',
      color: '#e2e8f0',
      fontSize: 12,
      maxWidth: 180,
    },
  }))

  const edges: Edge[] = trace.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: 'rgba(148, 163, 184, 0.4)', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(148, 163, 184, 0.5)' },
  }))

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      minZoom={0.5}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    >
      <Background color="rgba(148, 163, 184, 0.08)" gap={20} />
      <Controls className="!bg-surface-800 !border-surface-700" />
      <MiniMap
        className="!border-surface-700"
        style={{ background: '#0f172a' }}
        nodeColor={(n) =>
          n.data?.status === 'ok'
            ? 'rgba(34, 197, 94, 0.4)'
            : 'rgba(234, 179, 8, 0.4)'
        }
      />
    </ReactFlow>
  )
}
