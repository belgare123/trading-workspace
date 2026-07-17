/**
 * certification/index.ts — Barrel exports for Certification Suite
 *
 * @since 4.9
 */

// ── Core ──
export { CertificationRuntime } from './CertificationRuntime'
export type { CertificationRuntimeConfig, CertificationProgressCallback } from './CertificationRuntime'

export { ScenarioRegistry } from './ScenarioRegistry'
export { ScenarioRunner } from './ScenarioRunner'
export type { ScenarioRunnerConfig } from './ScenarioRunner'

export { CertificationReportBuilder } from './CertificationReport'
export type { CertificationReport, CategorySummary } from './CertificationReport'

// ── Types ──
export type {
  ScenarioId,
  ScenarioCategory,
  ScenarioSeverity,
  ScenarioVerdict,
  ScenarioOutcome,
  ScenarioContext,
  ScenarioDefinition,
  ScenarioExecute,
  ScenarioResult,
  ScenarioFilter,
} from './ScenarioDefinition'

export {
  scenarioId,
  ALL_CATEGORIES,
  scenarioPassed,
  scenarioFailed,
  scenarioSkipped,
} from './ScenarioDefinition'

// ── Builtins ──
export { connectivityScenarios } from './builtins/ConnectivityScenarios'
export { orderScenarios } from './builtins/OrderScenarios'
export { riskScenarios } from './builtins/RiskScenarios'
export { recoveryScenarios } from './builtins/RecoveryScenarios'
export { infrastructureScenarios } from './builtins/InfrastructureScenarios'
export { historyScenarios } from './builtins/HistoryScenarios'
export { metricsScenarios } from './builtins/MetricsScenarios'
