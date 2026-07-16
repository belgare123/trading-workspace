/**
 * risk/index.ts — Root barrel for the Risk Runtime module
 *
 * @since 4.7
 */

// ── Types ──

export type {
  RiskDecisionStatus,
  RiskViolation,
  RiskWarning,
  ModifiedOrderRequest,
  RiskDecision,
  RiskRuleConfig,
  RiskContext,
  RiskPosition,
  RiskAccount,
  MarketSnapshot,
  RiskReportEntry,
  KillSwitchState,
  RiskRuleSeverity,
} from './types'

// ── Definition ──

export { createRiskDefinition } from './definition/RiskDefinition'
export type { RiskRuleDefinition, RiskDefinitionParams } from './definition/RiskDefinition'

// ── Registry ──

export { RiskRegistry } from './registry/RiskRegistry'

// ── Runtime ──

export { RiskRuntime } from './runtime/RiskRuntime'
export { RiskPipeline } from './runtime/RiskPipeline'
export type { PipelineResult } from './runtime/RiskPipeline'
export { buildRiskContext } from './runtime/RiskContext'
export type { RiskContextSource } from './runtime/RiskContext'

// ── Events ──

export { RiskEventBus } from './events/RiskEventBus'
export type { RiskEventType, RiskEventPayload, RiskEventHandler } from './events/RiskEvents'

// ── Reports ──

export { RiskViolationLog } from './reports/RiskViolationLog'
export { RiskReport } from './reports/RiskReport'
export type { RiskSummary } from './reports/RiskReport'

// ── Utils ──

export { allow, modify, reject, computeRequiredMargin, fmt } from './utils/RiskHelpers'

// ── Built-in Rules ──

export {
  MaxPositionSizeRule,
  MaxExposureRule,
  MaxDailyLossRule,
  MaxDrawdownRule,
  MaxOpenPositionsRule,
  MaxOrdersPerMinuteRule,
  TradingSessionRule,
  SymbolWhitelistRule,
  CooldownRule,
  KillSwitchRule,
  BUILTIN_RISK_RULES,
  resetCooldowns,
  getCooldowns,
  triggerCooldown,
  isKillSwitchActive,
  activateStrategyKillSwitch,
  deactivateStrategyKillSwitch,
} from './builtins'
