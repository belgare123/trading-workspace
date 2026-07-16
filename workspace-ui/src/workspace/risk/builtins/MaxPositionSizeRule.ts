/**
 * MaxPositionSizeRule.ts — Limits the maximum size of a single position
 *
 * If the order would increase an existing position beyond the limit,
 * the rule either reduces the order quantity (modify) or rejects it.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject, fmt } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

export interface MaxPositionSizeParams {
  maxSize: number         // Max position size in base currency
  maxSizeUsd?: number     // Alternative: max position value in USD
  reduceOnExceed: boolean // true = modify (reduce), false = reject
}

export const MaxPositionSizeRule = createRiskDefinition({
  id: 'max_position_size',
  name: 'Max Position Size',
  description: 'Limits the maximum position size per symbol',
  defaultConfig: {
    severity: 'error',
    params: {
      maxSize: 10_000,
      maxSizeUsd: undefined,
      reduceOnExceed: true,
    } satisfies MaxPositionSizeParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as MaxPositionSizeParams
    const { order } = context
    const existing = context.positions.get(order.symbol)
    const existingQty = existing ? (existing.direction === 'long' ? existing.quantity : -existing.quantity) : 0
    const newTotal = order.side === 'buy' ? existingQty + order.quantity : existingQty - order.quantity
    const absTotal = Math.abs(newTotal)
    const limit = params.maxSize

    if (absTotal <= limit) {
      return { status: 'allow', violations: [], warnings: [], score: 1.0 }
    }

    if (params.reduceOnExceed) {
      const allowedNew = limit - Math.abs(existingQty)
      const reducedQty = Math.min(order.quantity, Math.max(0, allowedNew))
      return {
        status: 'modify',
        order: { ...order, quantity: reducedQty },
        violations: [{
          ruleId: 'max_position_size',
          ruleName: 'Max Position Size',
          severity: 'error',
          message: `Position size ${fmt(absTotal)} exceeds limit ${fmt(limit)}. Reduced to ${fmt(Math.abs(existingQty) + reducedQty)}`,
          currentValue: absTotal,
          limitValue: limit,
        }],
        warnings: [],
        score: 0.7,
      }
    }

    return reject('max_position_size', 'Max Position Size',
      `Position size ${fmt(absTotal)} exceeds limit ${fmt(limit)}`,
      absTotal, limit)
  },
})
