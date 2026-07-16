/**
 * builtins/index.ts — Barrel export for all built-in risk rules
 *
 * @since 4.7
 */

export { MaxPositionSizeRule } from './MaxPositionSizeRule'
export { MaxExposureRule } from './MaxExposureRule'
export { MaxDailyLossRule } from './MaxDailyLossRule'
export { MaxDrawdownRule } from './MaxDrawdownRule'
export { MaxOpenPositionsRule } from './MaxOpenPositionsRule'
export { MaxOrdersPerMinuteRule } from './MaxOrdersPerMinuteRule'
export { TradingSessionRule } from './TradingSessionRule'
export { SymbolWhitelistRule } from './SymbolWhitelistRule'
export { CooldownRule, resetCooldowns, getCooldowns, triggerCooldown } from './CooldownRule'
export { KillSwitchRule, isKillSwitchActive, activateStrategyKillSwitch, deactivateStrategyKillSwitch } from './KillSwitchRule'

import type { RiskRuleDefinition } from '../definition/RiskDefinition'
import { MaxPositionSizeRule } from './MaxPositionSizeRule'
import { MaxExposureRule } from './MaxExposureRule'
import { MaxDailyLossRule } from './MaxDailyLossRule'
import { MaxDrawdownRule } from './MaxDrawdownRule'
import { MaxOpenPositionsRule } from './MaxOpenPositionsRule'
import { MaxOrdersPerMinuteRule } from './MaxOrdersPerMinuteRule'
import { TradingSessionRule } from './TradingSessionRule'
import { SymbolWhitelistRule } from './SymbolWhitelistRule'
import { CooldownRule } from './CooldownRule'
import { KillSwitchRule } from './KillSwitchRule'

/** All built-in risk rules, ready for registration */
export const BUILTIN_RISK_RULES: RiskRuleDefinition[] = [
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
]
