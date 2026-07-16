/**
 * MaxExposureRule.ts — Limits total exposure (position value × leverage)
 *
 * Ensures the strategy's total notional exposure across all symbols
 * does not exceed the configured limit.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject, fmt } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface MaxExposureParams {
  maxExposure: number
  perSymbol?: boolean
  reduceOnExceed: boolean
}

export const MaxExposureRule = createRiskDefinition({
  id: 'max_exposure',
  name: 'Max Exposure',
  description: 'Limits total notional exposure across all positions',
  defaultConfig: {
    severity: 'error',
    params: {
      maxExposure: 50_000,
      perSymbol: false,
      reduceOnExceed: false,
    } satisfies MaxExposureParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as MaxExposureParams
    const { order } = context

    let currentExposure = 0
    for (const pos of context.positions.values()) {
      currentExposure += pos.quantity * pos.currentPrice * pos.leverage
    }

    const orderValue = order.quantity * (order.price ?? 0)
    const newExposure = currentExposure + orderValue

    if (newExposure <= params.maxExposure) {
      return { status: 'allow', violations: [], warnings: [], score: 1.0 }
    }

    if (params.reduceOnExceed) {
      const maxOrderValue = Math.max(0, params.maxExposure - currentExposure)
      const reducedQty = maxOrderValue / (order.price ?? 1)
      return {
        status: 'modify',
        order: { ...order, quantity: reducedQty },
        violations: [{
          ruleId: 'max_exposure',
          ruleName: 'Max Exposure',
          severity: 'error',
          message: `Total exposure ${fmt(newExposure)} exceeds limit ${fmt(params.maxExposure)}. Order reduced to ${fmt(reducedQty)}`,
          currentValue: newExposure,
          limitValue: params.maxExposure,
        }],
        warnings: [],
        score: 0.7,
      }
    }

    return reject('max_exposure', 'Max Exposure',
      `Total exposure ${fmt(newExposure)} exceeds limit ${fmt(params.maxExposure)}`,
      newExposure, params.maxExposure)
  },
})
