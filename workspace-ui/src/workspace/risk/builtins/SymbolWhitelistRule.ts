/**
 * SymbolWhitelistRule.ts — Restricts trading to approved symbols
 *
 * Only allows orders for symbols that are in the configured whitelist.
 * Optionally supports per-strategy whitelists.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface SymbolWhitelistParams {
  symbols: string[]
  perStrategy?: Record<string, string[]>
  rejectUnknown: boolean
}

export const SymbolWhitelistRule = createRiskDefinition({
  id: 'symbol_whitelist',
  name: 'Symbol Whitelist',
  description: 'Restricts trading to approved symbols',
  defaultConfig: {
    severity: 'error',
    params: {
      symbols: [],
      perStrategy: undefined,
      rejectUnknown: true,
    } satisfies SymbolWhitelistParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as SymbolWhitelistParams
    const { order } = context
    const strategyId = context.meta.strategyId

    // Check per-strategy whitelist first, then global
    const strategySymbols = params.perStrategy?.[strategyId]
    const allowedSymbols = strategySymbols ?? params.symbols

    if (allowedSymbols.length === 0) {
      // No whitelist configured = allow all
      return { status: 'allow', violations: [], warnings: [], score: 1.0 }
    }

    if (allowedSymbols.includes(order.symbol)) {
      return { status: 'allow', violations: [], warnings: [], score: 1.0 }
    }

    if (params.rejectUnknown) {
      return reject('symbol_whitelist', 'Symbol Whitelist',
        `Symbol "${order.symbol}" is not in the approved list`,
        order.symbol, allowedSymbols.join(', '))
    }

    return { status: 'allow', violations: [], warnings: [{
      ruleId: 'symbol_whitelist',
      ruleName: 'Symbol Whitelist',
      severity: 'warning',
      message: `Symbol "${order.symbol}" is not in the approved list`,
    }], score: 0.3 }
  },
})
