/**
 * CooldownRule.ts — Enforces a cooldown period after certain events
 *
 * Prevents rapid re-entry after a stop loss or order rejection.
 * Each symbol can have a cooldown that blocks new orders for N milliseconds.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface CooldownParams {
  defaultCooldownMs: number          // Default per-symbol cooldown
  perSymbolOverrides?: Record<string, number>
  triggerEvents: ('stop_loss' | 'take_profit' | 'rejection' | 'any')[]
}

// In-memory cooldown tracker (symbol → timestamp when cooldown ends)
const cooldowns = new Map<string, number>()

/** Reset all cooldowns (for testing / manual override) */
export function resetCooldowns(): void {
  cooldowns.clear()
}

export function getCooldowns(): Map<string, number> {
  return new Map(cooldowns)
}

export const CooldownRule = createRiskDefinition({
  id: 'cooldown',
  name: 'Cooldown',
  description: 'Enforces a cooldown period after stop loss, take profit, or rejection events',
  defaultConfig: {
    severity: 'error',
    params: {
      defaultCooldownMs: 30_000,
      perSymbolOverrides: undefined,
      triggerEvents: ['stop_loss', 'rejection'],
    } satisfies CooldownParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as CooldownParams
    const { order } = context
    const now = context.meta.now

    const symbolCooldown = params.perSymbolOverrides?.[order.symbol] ?? params.defaultCooldownMs
    const cooldownUntil = cooldowns.get(order.symbol)

    if (cooldownUntil && now < cooldownUntil) {
      const remaining = cooldownUntil - now
      return reject('cooldown', 'Cooldown',
        `Symbol "${order.symbol}" is in cooldown for ${(remaining / 1000).toFixed(0)}s more`,
        `${(remaining / 1000).toFixed(0)}s`, `${symbolCooldown / 1000}s`)
    }

    return { status: 'allow', violations: [], warnings: [], score: 1.0 }
  },
})

/**
 * Signal a cooldown-triggering event for a symbol
 * This would be called by the EventAdapter / LiveProvider
 */
export function triggerCooldown(symbol: string, _event: 'stop_loss' | 'take_profit' | 'rejection', cooldownMs: number): void {
  const until = Date.now() + cooldownMs
  const existing = cooldowns.get(symbol) ?? 0
  // Keep the longer cooldown
  if (until > existing) {
    cooldowns.set(symbol, until)
  }
}
