// ── Trading Workspace Composition: barrel ──
// Sprint 5.4 — Workspace Composition & Lifecycle

export { LifecycleManager, LifecycleError, InvalidTransitionError } from './LifecycleManager'
export type { LifecycleState, LifecycleEventType, LifecycleEventHandler } from './types'
export { LIFECYCLE_STATES, LIFECYCLE_TRANSITIONS } from './types'

export { StartupRecoveryRuntime } from './StartupRecoveryRuntime'
export type { StartupRecoveryDeps } from './StartupRecoveryRuntime'

export {
  WorkspaceBuilder,
  WorkspaceFactory,
  Workspace,
} from './WorkspaceBuilder'

export type {
  TradingConfig,
  RecoveryReport,
  WorkspaceHealth,
  RuntimeId,
  RuntimeDependency,
} from './types'

export {
  TradingComposition,
  RuntimeFactory,
  DependencyGraph,
} from './TradingComposition'
export type { RuntimeDependencyEdge } from './TradingComposition'
export { DEFAULT_RUNTIME_ORDER } from './types'
