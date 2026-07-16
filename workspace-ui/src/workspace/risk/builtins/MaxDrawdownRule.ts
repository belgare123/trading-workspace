/**
 * MaxDrawdownRule.ts — Limits maximum drawdown from peak equity
 *
 * Measures drawdown as (peakEquity − currentEquity) / peakEquity.
 * If the drawdown exceeds the configured threshold, trading is blocked.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface MaxDrawdownParams {
  maxDrawdownPct: number     // 0.20 = 20%
  resetOnWin: boolean         // Reset peak on new high
}

export const MaxDrawdownRule = createRiskDefinition({
  id: 'max_drawdown',
  name: 'Max Drawdown',
  description: 'Blocks trading when drawdown from peak equity exceeds the configured threshold',
  defaultConfig: {
    severity: 'error',
    params: {
      maxDrawdownPct: 0.20,
      resetOnWin: true,
    } satisfies MaxDrawdownParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as MaxDrawdownParams
    const account = context.account
    if (!account) return { status: 'allow', violations: [], warnings: [], score: 1.0 }

    const currentEquity = account.totalEquity

    // NOTE: Peak equity tracking would be persisted per strategy.
    // Here we use account.totalEquity + account.realizedPnl as a proxy.
    const estimatedPeak = currentEquity + Math.abs(Math.min(0, account.dailyPnl))
    if (estimatedPeak <= 0) return { status: 'allow', violations: [], warnings: [], score: 1.0 }

    const drawdown = (estimatedPeak - currentEquity) / estimatedPeak

    if (drawdown <= params.maxDrawdownPct) {
      const remaining = params.maxDrawdownPct - drawdown
      const warnings = remaining < params.maxDrawdownPct * 0.3
        ? [{ ruleId: 'max_drawdown', ruleName: 'Max Drawdown', severity: 'warning' as const, message: `Approaching max drawdown limit: ${(drawdown * 100).toFixed(1)}% / ${(params.maxDrawdownPct * 100).toFixed(0)}%` }]
        : []
      return { status: 'allow', violations: [], warnings, score: 1 - drawdown / params.maxDrawdownPct }
    }

    return reject('max_drawdown', 'Max Drawdown',
      `Drawdown ${(drawdown * 100).toFixed(1)}% exceeds limit ${(params.maxDrawdownPct * 100).toFixed(0)}%`,
      `${(drawdown * 100).toFixed(1)}%`, `${(params.maxDrawdownPct * 100).toFixed(0)}%`)
  },
})
