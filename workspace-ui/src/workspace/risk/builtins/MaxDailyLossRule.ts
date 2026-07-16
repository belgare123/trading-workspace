/**
 * MaxDailyLossRule.ts — Limits total daily realized + unrealized loss
 *
 * Tracks cumulative PnL for the trading day. If the loss exceeds the
 * configured limit, the rule rejects the order.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject, fmt } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface MaxDailyLossParams {
  maxLoss: number        // Maximum allowed daily loss (positive number)
  includeUnrealized: boolean
}

export const MaxDailyLossRule = createRiskDefinition({
  id: 'max_daily_loss',
  name: 'Max Daily Loss',
  description: 'Limits the total daily loss (realized + optional unrealized)',
  defaultConfig: {
    severity: 'error',
    params: {
      maxLoss: 5_000,
      includeUnrealized: true,
    } satisfies MaxDailyLossParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as MaxDailyLossParams
    const account = context.account
    if (!account) {
      return { status: 'allow', violations: [], warnings: [], score: 1.0 }
    }

    const dailyPnl = account.dailyPnl
    const unrealized = params.includeUnrealized ? account.unrealizedPnl : 0
    const totalLoss = Math.abs(Math.min(0, dailyPnl + unrealized))

    if (totalLoss <= params.maxLoss) {
      // Emit a warning if we're close to the limit
      const remaining = params.maxLoss - totalLoss
      const warnings = remaining < params.maxLoss * 0.2
        ? [{ ruleId: 'max_daily_loss', ruleName: 'Max Daily Loss', severity: 'warning' as const, message: `Approaching daily loss limit: ${fmt(totalLoss)} / ${fmt(params.maxLoss)}` }]
        : []

      return { status: 'allow', violations: [], warnings, score: remaining / params.maxLoss }
    }

    return reject('max_daily_loss', 'Max Daily Loss',
      `Daily loss ${fmt(totalLoss)} exceeds limit ${fmt(params.maxLoss)}`,
      totalLoss, params.maxLoss)
  },
})
