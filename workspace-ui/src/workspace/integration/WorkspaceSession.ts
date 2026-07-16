/**
 * WorkspaceSession.ts — Full workspace session state
 *
 * A WorkspaceSession is the unified serializable state of the entire workspace:
 * - Layout (panels, positions, sizes)
 * - Chart state (chart instances, instruments, overlays, indicators, drawings)
 * - Strategy state (graphs, signal/condition/action registrations)
 * - Builder state (visual graph, viewport, palette)
 * - Backtest / Optimization / Report sessions
 *
 * The session is the single source of truth for workspace persistence.
 *
 * @since 3.7.1
 */

import type { WorkspacePersistenceState } from '../layout/types'

// ── Session identifier ──

export type SessionId = string

// ── Chart-specific state ──

export interface ChartSessionState {
  /** Active instrument/pair */
  symbol?: string
  /** Selected timeframe */
  timeframe?: string
  /** Viewport position/zoom */
  viewport?: {
    offsetX: number
    offsetY: number
    zoomX: number
    zoomY: number
  }
  /** Active indicator instances by pane id */
  activeIndicators?: Record<string, string[]>
  /** Drawing instances */
  drawings?: Array<{ type: string; points: unknown[]; options?: Record<string, unknown> }>
  /** Overlay instances */
  overlays?: Array<{ type: string; data: unknown; options?: Record<string, unknown> }>
  /** Pane layout (heights, splits) */
  panes?: Array<{ id: string; heightRatio: number }>
}

// ── Strategy-specific state ──

export interface StrategySessionState {
  /** Serialized strategy graph (JSON) */
  graph?: string
  /** Graph viewport/view state */
  viewport?: {
    offsetX: number
    offsetY: number
    zoomX: number
    zoomY: number
  }
}

// ── Builder-specific state ──

export interface BuilderSessionState {
  /** Serialized strategy graph (same as StrategySessionState.graph, may differ in editing mode) */
  graph?: string
  /** Builder viewport state */
  viewport?: {
    offsetX: number
    offsetY: number
    zoomX: number
    zoomY: number
  }
  /** Selected node id */
  selectedNodeId?: string
  /** Palette search / filter state */
  paletteFilter?: string
  /** Minimap visibility */
  minimapVisible?: boolean
}

// ── Backtest session state ──

export interface BacktestSessionState {
  /** Active backtest id */
  activeBacktestId?: string
  /** Backtest results */
  results?: Array<{
    id: string
    name: string
    timestamp: number
    metrics: Record<string, number>
  }>
}

// ── Optimization session state ──

export interface OptimizationSessionState {
  /** Active optimization id */
  activeOptimizationId?: string
  /** Optimization results */
  results?: Array<{
    id: string
    name: string
    timestamp: number
    parameters: Record<string, unknown>
    metrics: Record<string, number>
  }>
}

// ── Report session state ──

export interface ReportSessionState {
  /** Active report id */
  activeReportId?: string
  /** Open reports */
  openReports?: string[]
}

// ── Full workspace session ──

export interface WorkspaceSession {
  /** Unique session identifier */
  id: SessionId
  /** Human-readable session name */
  name: string
  /** Schema version for migration */
  version: number
  /** Creation timestamp */
  createdAt: number
  /** Last modification timestamp */
  updatedAt: number

  /** Layout state (panels, positions, active layout) */
  layout: WorkspacePersistenceState

  /** Per-panel chart state keyed by panel id */
  charts?: Record<string, ChartSessionState>

  /** Per-panel strategy state keyed by panel id */
  strategies?: Record<string, StrategySessionState>

  /** Per-panel builder state keyed by panel id */
  builders?: Record<string, BuilderSessionState>

  /** Backtest sessions */
  backtests?: Record<string, BacktestSessionState>

  /** Optimization sessions */
  optimizations?: Record<string, OptimizationSessionState>

  /** Report sessions */
  reports?: Record<string, ReportSessionState>
}

// ── Version ──

export const WORKSPACE_SESSION_VERSION = 1
