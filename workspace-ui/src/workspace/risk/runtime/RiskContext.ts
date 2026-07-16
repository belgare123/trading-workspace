/**
 * RiskContext.ts — Builds a RiskContext from order request + system state
 *
 * @since 4.7
 */

import type { RiskContext, RiskPosition, RiskAccount, MarketSnapshot } from '../types'
import type { OrderRequest } from '../../execution/types'

export interface RiskContextSource {
  getPositions: (strategyId: string) => Map<string, RiskPosition>
  getAccount: (strategyId: string) => RiskAccount | undefined
  getMarket: () => MarketSnapshot | undefined
}

export function buildRiskContext(
  order: OrderRequest,
  source: RiskContextSource,
  mode: 'simulation' | 'paper' | 'live' = 'live',
): RiskContext {
  const strategyId = order.strategyId
  const positions = source.getPositions(strategyId) ?? new Map()
  const account = source.getAccount(strategyId)
  const market = source.getMarket()

  return {
    order,
    positions,
    account,
    market,
    previousViolations: [],
    meta: {
      now: Date.now(),
      mode,
      strategyId,
    },
  }
}
