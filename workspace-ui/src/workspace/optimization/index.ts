// ── Optimization Module — Barrel Export ──
//
// Sprint 3.5.4 — Optimization Platform
//
// @since 3.5.4

// ── Types ──
export type {
  ParamType,
  ParameterDefinition,
  Constraint,
  ParameterSpace,
  TrialStatus,
  TrialConfig,
  TrialResult,
  ObjectiveDefinition,
  OptimizationStatus,
  OptimizationConfig,
  OptimizationSessionInfo,
  OptimizationProgress,
  OptimizationAlgorithm,
  RankEntry,
  ParetoFrontEntry,
} from './types'

// ── Parameters ──
export { ParameterDefinition as ParameterDefinitionClass } from './parameters/ParameterDefinition'
export { ParameterSpace as ParameterSpaceClass } from './parameters/ParameterSpace'
export { ParameterGenerator } from './parameters/ParameterGenerator'
export {
  Constraint as ConstraintClass,
  lessThan,
  lessOrEqual,
  equals,
  oneOf,
  constraint,
} from './parameters/Constraints'

// ── Objectives ──
export { ObjectiveRegistry } from './objectives/ObjectiveRegistry'
export { requireMetric } from './objectives/ObjectiveDefinition'
export { ProfitObjective } from './objectives/ProfitObjective'
export { SharpeObjective } from './objectives/SharpeObjective'
export { SortinoObjective } from './objectives/SortinoObjective'
export { MaxDrawdownObjective } from './objectives/MaxDrawdownObjective'
export { ProfitFactorObjective } from './objectives/ProfitFactorObjective'
export { CompositeObjective } from './objectives/CompositeObjective'

// ── Algorithms ──
export { GridSearch } from './algorithms/GridSearch'
export { RandomSearch } from './algorithms/RandomSearch'
export { LatinHypercube } from './algorithms/LatinHypercube'
export { WalkForwardOptimization } from './algorithms/WalkForwardOptimization'
export { MonteCarloOptimization } from './algorithms/MonteCarloOptimization'

export type { WalkForwardConfig } from './algorithms/WalkForwardOptimization'

// ── Ranking ──
export { RankingEngine } from './ranking/RankingEngine'
export { ParetoFront } from './ranking/ParetoFront'
export { Leaderboard } from './ranking/Leaderboard'
export type { LeaderboardEntry } from './ranking/Leaderboard'

// ── Reports ──
export { TrialSummaryBuilder } from './reports/TrialSummary'
export type { TrialSummary } from './reports/TrialSummary'
export { HeatmapBuilder, type HeatmapCell, type HeatmapData } from './reports/HeatmapData'
export { OptimizationReportBuilder } from './reports/OptimizationReport'
export type { OptimizationReportData } from './reports/OptimizationReport'

// ── Persistence ──
export { OptimizationSerializer } from './persistence/OptimizationSerializer'
export type { OptimizationState } from './persistence/OptimizationSerializer'
export { OptimizationMigration } from './persistence/OptimizationMigration'

// ── Runtime ──
export { TrialRunner } from './runtime/TrialRunner'
export { TrialScheduler } from './runtime/TrialScheduler'
export { OptimizationSession } from './runtime/OptimizationSession'
export { OptimizationRuntime } from './runtime/OptimizationRuntime'

export type {
  TrialSchedulerEvent,
  TrialEventHandler,
} from './runtime/TrialScheduler'
