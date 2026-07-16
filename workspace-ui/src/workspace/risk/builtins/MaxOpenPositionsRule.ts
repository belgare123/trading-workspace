/**
 * MaxOpenPositionsRule.ts — Limits the number of open positions
 *
 * Ensures the strategy does not exceed the maximum number of
 * concurrently open positions.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface MaxOpenPositionsParams {
  maxOpen: number
  perDirection?: boolean   // true = separate limit for long/short
}

export const MaxOpenPositionsRule = createRiskDefinition({
  id: 'max_open_positions',
  name: 'Max Open Positions',
  description: 'Limits the number of concurrently open positions',
  defaultConfig: {
    severity: 'error',
    params: {
      maxOpen: 10,
      perDirection: false,
    } satisfies MaxOpenPositionsParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as MaxOpenPositionsParams
    let openCount = 0
    let longCount = 0
    let shortCount = 0

    for (const pos of context.positions.values()) {
      if (pos.quantity > 0) {
        openCount++
        if (pos.direction === 'long') longCount++
        else shortCount++
      }
    }

    if (params.perDirection) {
      const side = context.order.side
      const count = side === 'buy' ? longCount : shortCount
      if (count >= params.maxOpen) {
        return reject('max_open_positions', 'Max Open Positions',
          `Already at max ${side} positions (${count}/${params.maxOpen})`,
          count, params.maxOpen)
      }
    } else {
      if (openCount >= params.maxOpen) {
        return reject('max_open_positions', 'Max Open Positions',
          `Already at max open positions (${openCount}/${params.maxOpen})`,
          openCount, params.maxOpen)
      }
    }

    return { status: 'allow', violations: [], warnings: [
      ...(openCount >= params.maxOpen * 0.8
        ? [{ ruleId: 'max_open_positions', ruleName: 'Max Open Positions', severity: 'warning' as const, message: `Approaching position limit: ${openCount}/${params.maxOpen}` }]
        : []),
    ], score: openCount / params.maxOpen }
  },
})
