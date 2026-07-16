// ── Conditions barrel ──
// Sprint 3.4.4 — Condition Engine
//
// @since 3.4.4

export type {
  ConditionResult,
  ConditionNode,
  ConditionInput,
  ConditionParameter,
} from './types'

export type {
  ConditionDefinition,
  ConditionEvaluationOutput,
} from './definition/ConditionDefinition'

export { ConditionRegistry } from './registry/ConditionRegistry'
export { ConditionRuntime } from './runtime/ConditionRuntime'

// Builtins
export { registerAll as registerBuiltinConditions } from './builtins/index'
export {
  AndCondition,
  OrCondition,
  NotCondition,
  XorCondition,
  SequenceCondition,
  CooldownCondition,
  TimeWindowCondition,
  PositionStateCondition,
  DrawdownCondition,
} from './builtins/index'

// Utils
export {
  isInTimeWindow,
  aggregateScore,
  collectMatchedSignals,
  collectReasons,
} from './utils/ConditionHelpers'
