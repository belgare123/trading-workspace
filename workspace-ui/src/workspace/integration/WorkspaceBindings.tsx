/**
 * WorkspaceBindings.ts — Panel definitions for platform modules
 *
 * Registers PanelDefinitions for Chart Studio, Strategy Studio,
 * and Visual Strategy Builder as workspace panels.
 *
 * Each binding provides:
 * - A unique panel id
 * - A render function (React component)
 * - Metadata for the PanelRegistry
 *
 * @since 3.7.1
 */

import { panelRegistry } from '../panels/PanelRegistry'
import type { PanelDefinition, PanelContext, Size } from '../panels/PanelDefinition'
import type { ReactNode } from 'react'

// ── Panel IDs ──

export const PANEL_CHART = 'platform-chart'
export const PANEL_BUILDER = 'platform-builder'
export const PANEL_STRATEGY_GRAPH = 'platform-strategy-graph'
export const PANEL_STRATEGY_SIGNALS = 'platform-strategy-signals'
export const PANEL_STRATEGY_CONDITIONS = 'platform-strategy-conditions'
export const PANEL_STRATEGY_ACTIONS = 'platform-strategy-actions'
export const PANEL_BACKTEST = 'platform-backtest'
export const PANEL_OPTIMIZATION = 'platform-optimization'
export const PANEL_REPORT = 'platform-report'

// ── Lazy component loader ──
// Components are lazy-loaded so the integration module doesn't
// pull in all UI modules at bundle time. Each loader returns
// a React component (ReactNode) given the PanelContext.

export type ComponentLoader = (ctx: PanelContext) => ReactNode

// ── Registry helper ──

function registerPanel(
  id: string,
  title: string,
  widgetId: string,
  render: ComponentLoader,
  description?: string,
  defaultSize?: Size,
  minSize?: Size,
): PanelDefinition {
  const def: PanelDefinition = {
    id,
    title,
    widgetId,
    render,
    defaultSize: defaultSize ?? { width: 1, height: 1 },
    minSize: minSize ?? { width: 0.2, height: 0.15 },
  }
  panelRegistry.register(def, description)
  return def
}

// ── Register all platform bindings ──

/**
 * Register chart panel binding.
 * Charts are rendered via ChartRuntime + ChartHost.
 * The render function is a thin wrapper that delegates to
 * the chart module's React rendering infrastructure.
 */
export function registerChartBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_CHART,
    'Chart',
    'chart',
    renderFn,
    'Interactive chart with candles, indicators, overlays and drawings',
  )
}

/**
 * Register visual builder panel binding.
 * Renders the Strategy Builder Shell with canvas, palette,
 * inspector, and minimap.
 */
export function registerBuilderBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_BUILDER,
    'Strategy Builder',
    'strategy-builder',
    renderFn,
    'Visual strategy builder with drag-and-drop graph editor',
  )
}

/**
 * Register strategy graph panel binding.
 * Shows the strategy graph in read-only mode with runtime status.
 */
export function registerStrategyGraphBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_STRATEGY_GRAPH,
    'Strategy Graph',
    'strategy-graph',
    renderFn,
    'Read-only strategy graph with execution status',
  )
}

/**
 * Register strategy signals panel binding.
 */
export function registerStrategySignalsBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_STRATEGY_SIGNALS,
    'Signals',
    'strategy-signals',
    renderFn,
    'Signal engine configuration and live signal feed',
  )
}

/**
 * Register strategy conditions panel binding.
 */
export function registerStrategyConditionsBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_STRATEGY_CONDITIONS,
    'Conditions',
    'strategy-conditions',
    renderFn,
    'Condition engine configuration and evaluation status',
  )
}

/**
 * Register strategy actions panel binding.
 */
export function registerStrategyActionsBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_STRATEGY_ACTIONS,
    'Actions',
    'strategy-actions',
    renderFn,
    'Action engine configuration and execution log',
  )
}

/**
 * Register backtest panel binding.
 */
export function registerBacktestBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_BACKTEST,
    'Backtest',
    'backtest',
    renderFn,
    'Strategy backtesting with metrics and charts',
  )
}

/**
 * Register optimization panel binding.
 */
export function registerOptimizationBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_OPTIMIZATION,
    'Optimization',
    'optimization',
    renderFn,
    'Strategy parameter optimization with hyperopt',
  )
}

/**
 * Register reports panel binding.
 */
export function registerReportBinding(renderFn: ComponentLoader): PanelDefinition {
  return registerPanel(
    PANEL_REPORT,
    'Reports',
    'report',
    renderFn,
    'Backtest and optimization reports',
  )
}

// ── Bulk registration ──

const defaultBindings: Array<{ id: string; title: string; widgetId: string; description: string }> = [
  { id: PANEL_CHART, title: 'Chart', widgetId: 'chart', description: 'Interactive chart' },
  { id: PANEL_BUILDER, title: 'Strategy Builder', widgetId: 'strategy-builder', description: 'Visual strategy builder' },
  { id: PANEL_STRATEGY_GRAPH, title: 'Strategy Graph', widgetId: 'strategy-graph', description: 'Strategy graph status' },
  { id: PANEL_STRATEGY_SIGNALS, title: 'Signals', widgetId: 'strategy-signals', description: 'Signal engine' },
  { id: PANEL_STRATEGY_CONDITIONS, title: 'Conditions', widgetId: 'strategy-conditions', description: 'Condition engine' },
  { id: PANEL_STRATEGY_ACTIONS, title: 'Actions', widgetId: 'strategy-actions', description: 'Action engine' },
  { id: PANEL_BACKTEST, title: 'Backtest', widgetId: 'backtest', description: 'Backtesting' },
  { id: PANEL_OPTIMIZATION, title: 'Optimization', widgetId: 'optimization', description: 'Optimization' },
  { id: PANEL_REPORT, title: 'Reports', widgetId: 'report', description: 'Reports' },
]

/**
 * Register a set of stub/placeholder panels for initial integration.
 * These will be replaced with real components in Sprint 3.7.2.
 *
 * Pass `renderAll` to set a single fallback render for all panels,
 * or omit to use the default placeholder.
 */
export function registerDefaultBindings(
  renderMap?: Partial<Record<string, ComponentLoader>>,
  defaultRender?: ComponentLoader,
): void {
  const fallback: ComponentLoader = (ctx: PanelContext) => {
    const { panel } = ctx
    return (
      <div style={{ padding: 16, color: 'var(--text-muted, #888)', fontSize: 13 }}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text, #ddd)', fontSize: 14 }}>
          {panel.tabs[0]?.title ?? panel.id}
        </h3>
        <p>Panel not yet implemented.</p>
        <p style={{ fontSize: 11, color: '#555' }}>{panel.id}</p>
      </div>
    )
  }

  for (const binding of defaultBindings) {
    const customRender = renderMap?.[binding.id]
    const render = customRender ?? defaultRender ?? fallback
    panelRegistry.register(
      {
        id: binding.id,
        title: binding.title,
        widgetId: binding.widgetId,
        render,
        defaultSize: { width: 1, height: 1 },
        minSize: { width: 0.2, height: 0.15 },
      },
      binding.description,
    )
  }
}
