/**
 * StateExplorer — дерево состояния Runtime (Redux DevTools стиль)
 *
 * @since 2.0.0
 */

import { useState } from 'react'

interface TreeNode {
  key: string
  label: string
  value?: string
  children?: TreeNode[]
}

const RUNTIME_TREE: TreeNode[] = [
  {
    key: 'services',
    label: 'Services',
    children: [
      { key: 'services.market', label: 'Market', value: 'online · 5 symbols' },
      { key: 'services.portfolio', label: 'Portfolio', value: '2 positions · $12,450 P&L' },
      { key: 'services.strategy', label: 'Strategy', value: '1 active · 4 total' },
      { key: 'services.replay', label: 'Replay', value: 'idle · no active session' },
      { key: 'services.ml', label: 'ML', value: '3 models · 78% accuracy' },
      { key: 'services.eventStore', label: 'EventStore', value: '1,420 events stored' },
    ],
  },
  {
    key: 'widgets',
    label: 'Widgets',
    children: [
      { key: 'widgets.market-overview', label: 'Market Overview', value: '3x2 · grid(0,0)' },
      { key: 'widgets.heatmap', label: 'Market Heatmap', value: '3x4 · grid(3,0)' },
      { key: 'widgets.positions', label: 'Positions', value: '4x3 · grid(0,4)' },
      { key: 'widgets.orderbook', label: 'Order Book', value: '3x6 · grid(3,4)' },
    ],
  },
  {
    key: 'plugins',
    label: 'Plugins',
    children: [
      { key: 'plugins.hello-widget', label: 'hello-widget', value: 'v1.0.0 · loaded' },
      { key: 'plugins.hello-plugin', label: 'hello-plugin', value: 'v1.0.0 · loaded' },
      { key: 'plugins.market-heatmap', label: 'market-heatmap', value: 'v1.0.0 · loaded' },
      { key: 'plugins.orderbook', label: 'orderbook-depth', value: 'v1.0.0 · unloaded' },
    ],
  },
  {
    key: 'commands',
    label: 'Commands',
    children: [
      { key: 'cmd.view', label: 'view.*', value: '4 commands' },
      { key: 'cmd.replay', label: 'replay.*', value: '3 commands' },
      { key: 'cmd.risk', label: 'risk.*', value: '2 commands' },
      { key: 'cmd.ml', label: 'ml.*', value: '2 commands' },
    ],
  },
  {
    key: 'search',
    label: 'Search Adapters',
    children: [
      { key: 'search.risk', label: 'risk-search', value: '1 plugin indexed' },
      { key: 'search.ml', label: 'ml-model-search', value: '3 models indexed' },
    ],
  },
  {
    key: 'timeline',
    label: 'Timeline',
    value: '142 events · 24 active',
  },
  {
    key: 'eventbus',
    label: 'EventBus',
    value: '28 topics · 12 active listeners',
  },
  {
    key: 'recorder',
    label: 'Recorder',
    value: 'ring buffer: 1000 · 0 recorded',
  },
  {
    key: 'layout',
    label: 'Layout',
    value: '4 grids · dark theme',
  },
  {
    key: 'capabilities',
    label: 'Capabilities',
    value: '24 granted · 6 denied',
  },
]

function StateTreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children && node.children.length > 0

  return (
    <>
      <div
        className="tree-row"
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
      >
        {hasChildren && (
          <span className="tree-chevron">{expanded ? '▼' : '▶'}</span>
        )}
        {!hasChildren && <span className="tree-chevron tree-leaf-gap" />}
        <span className="tree-label">{node.label}</span>
        {node.value && <span className="tree-value">{node.value}</span>}
      </div>
      {expanded && hasChildren &&
        node.children!.map((child) => (
          <StateTreeItem key={child.key} node={child} depth={depth + 1} />
        ))
      }
    </>
  )
}

export function StateExplorer() {
  return (
    <div className="playground-panel">
      <h3 className="panel-title">🌳 Runtime State Explorer</h3>
      <p className="panel-desc">Full Runtime state tree — like Redux DevTools</p>

      <div className="state-tree">
        {RUNTIME_TREE.map((node) => (
          <StateTreeItem key={node.key} node={node} depth={0} />
        ))}
      </div>
    </div>
  )
}
