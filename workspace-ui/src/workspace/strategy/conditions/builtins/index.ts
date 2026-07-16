// ── Built-in conditions barrel ──
// Registers all built-in conditions with ConditionRegistry.
//
// Call registerAll() once at application startup to make
// all built-in conditions available.
//
// @since 3.4.4

import { ConditionRegistry } from '../registry/ConditionRegistry'

// Logical
import { AndCondition } from './AndCondition'
import { OrCondition } from './OrCondition'
import { NotCondition } from './NotCondition'
import { XorCondition } from './XorCondition'

// Temporal
import { SequenceCondition } from './SequenceCondition'
import { CooldownCondition } from './CooldownCondition'

// Contextual
import { TimeWindowCondition } from './TimeWindowCondition'
import { PositionStateCondition } from './PositionStateCondition'
import { DrawdownCondition } from './DrawdownCondition'

/** Register all built-in conditions */
export function registerAll(): void {
  const registry = ConditionRegistry.getInstance()

  // Logical
  registry.register(AndCondition)
  registry.register(OrCondition)
  registry.register(NotCondition)
  registry.register(XorCondition)

  // Temporal
  registry.register(SequenceCondition)
  registry.register(CooldownCondition)

  // Contextual
  registry.register(TimeWindowCondition)
  registry.register(PositionStateCondition)
  registry.register(DrawdownCondition)
}

export {
  // Logical
  AndCondition,
  OrCondition,
  NotCondition,
  XorCondition,
  // Temporal
  SequenceCondition,
  CooldownCondition,
  // Contextual
  TimeWindowCondition,
  PositionStateCondition,
  DrawdownCondition,
}
