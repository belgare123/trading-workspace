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

// ── Workspace Synchronization (3.7.2) ──

export {
  WorkspaceSync,
  workspaceSync,
} from './WorkspaceSync'
export type {
  SyncEvent,
  SyncListener,
} from './WorkspaceSync'

// ── Thin React Panel Components (3.7.2) ──

export { ChartPanel } from './panels/ChartPanel'
export { BuilderPanel } from './panels/BuilderPanel'
export { StrategyPanel } from './panels/StrategyPanel'
export { BacktestPanel } from './panels/BacktestPanel'
export { ReportPanel } from './panels/ReportPanel'

// ── End-to-End Flow Validation (3.7.2) ──

export {
  E2EFlowValidator,
} from './validation/E2EFlowValidator'
export type {
  E2EStepResult,
  E2EFlowResult,
} from './validation/E2EFlowValidator'
