/**
 * index.ts — Integration Layer barrel export
 *
 * @since 3.7.1
 */

// ── Workspace Session ──

export type {
  WorkspaceSession,
  SessionId,
  ChartSessionState,
  StrategySessionState,
  BuilderSessionState,
  BacktestSessionState,
  OptimizationSessionState,
  ReportSessionState,
} from './WorkspaceSession'
export { WORKSPACE_SESSION_VERSION } from './WorkspaceSession'

// ── Workspace Serializer ──

export {
  WorkspaceSerializer,
  workspaceSerializer,
  createBlankSession,
} from './WorkspaceSerializer'
export type {
  SerializeOptions,
} from './WorkspaceSerializer'

// ── Workspace Migration ──

export {
  WorkspaceMigration,
  workspaceMigration,
} from './WorkspaceMigration'

// ── Workspace Bindings ──

export {
  registerChartBinding,
  registerBuilderBinding,
  registerStrategyGraphBinding,
  registerStrategySignalsBinding,
  registerStrategyConditionsBinding,
  registerStrategyActionsBinding,
  registerBacktestBinding,
  registerOptimizationBinding,
  registerReportBinding,
  registerDefaultBindings,
  PANEL_CHART,
  PANEL_BUILDER,
  PANEL_STRATEGY_GRAPH,
  PANEL_STRATEGY_SIGNALS,
  PANEL_STRATEGY_CONDITIONS,
  PANEL_STRATEGY_ACTIONS,
  PANEL_BACKTEST,
  PANEL_OPTIMIZATION,
  PANEL_REPORT,
} from './WorkspaceBindings'
export type { ComponentLoader } from './WorkspaceBindings'

// ── Workspace Composition ──

export {
  WorkspaceComposition,
  workspaceComposition,
} from './WorkspaceComposition'
export type {
  ModuleStatus,
  ModuleState,
  CompositionEventMap,
} from './WorkspaceComposition'
