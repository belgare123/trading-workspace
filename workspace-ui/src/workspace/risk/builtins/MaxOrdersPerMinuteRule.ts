/**
 * MaxOrdersPerMinuteRule.ts — Rate-limits order submissions per strategy
 *
 * Ensures the strategy doesn't submit orders faster than the configured rate.
 * Uses a sliding window counter internally.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface MaxOrdersPerMinuteParams {
  maxOrders: number
  windowMs: number
}

// Global counter per strategy (in-memory, reset on restart)
const orderTimestamps = new Map<string, number[]>()

function getRecentCount(strategyId: string, windowMs: number, now: number): number {
  const timestamps = orderTimestamps.get(strategyId)
  if (!timestamps) return 0
  const cutoff = now - windowMs
  return timestamps.filter(t => t >= cutoff).length
}

function recordOrder(strategyId: string, now: number): void {
  if (!orderTimestamps.has(strategyId)) {
    orderTimestamps.set(strategyId, [])
  }
  const timestamps = orderTimestamps.get(strategyId)!
  timestamps.push(now)
  // Trim old entries
  const cutoff = now - 60_000
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift()
  }
}

export const MaxOrdersPerMinuteRule = createRiskDefinition({
  id: 'max_orders_per_minute',
  name: 'Max Orders Per Minute',
  description: 'Rate-limits order submissions per strategy within a sliding window',
  defaultConfig: {
    severity: 'error',
    params: {
      maxOrders: 20,
      windowMs: 60_000,
    } satisfies MaxOrdersPerMinuteParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as MaxOrdersPerMinuteParams
    const now = context.meta.now
    const strategyId = context.meta.strategyId

    const recentCount = getRecentCount(strategyId, params.windowMs, now)
    // Record this order attempt
    recordOrder(strategyId, now)

    if (recentCount >= params.maxOrders) {
      return reject('max_orders_per_minute', 'Max Orders Per Minute',
        `Order rate ${recentCount}/${(params.windowMs / 1000).toFixed(0)}s exceeds limit ${params.maxOrders}`,
        recentCount, params.maxOrders)
    }

    const remaining = params.maxOrders - recentCount
    return {
      status: 'allow',
      violations: [],
      warnings: remaining <= 3
        ? [{ ruleId: 'max_orders_per_minute', ruleName: 'Max Orders Per Minute', severity: 'warning' as const, message: `Order rate approaching limit: ${recentCount}/${params.maxOrders}` }]
        : [],
      score: recentCount / params.maxOrders,
    }
  },
})
