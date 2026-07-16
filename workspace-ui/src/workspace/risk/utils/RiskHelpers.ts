/**
 * RiskHelpers.ts — Utility functions for risk computation
 *
 * @since 4.7
 */

import type { RiskDecision } from '../types'

/** Create an 'allow' decision */
export function allow(score = 1.0): RiskDecision {
  return {
    status: 'allow',
    violations: [],
    warnings: [],
    score,
  }
}

/** Create a 'modify' decision with adjusted order parameters */
export function modify(
  violations: { ruleId: string; ruleName: string; message: string; currentValue?: string | number; limitValue?: string | number }[],
  warnings?: { ruleId: string; ruleName: string; message: string }[],
  score = 0.7,
): RiskDecision {
  return {
    status: 'modify',
    violations: violations.map(v => ({ ...v, severity: 'error' as const })),
    warnings: (warnings ?? []).map(w => ({ ...w, severity: 'warning' as const })),
    score,
  }
}

/** Create a 'reject' decision */
export function reject(
  ruleId: string,
  ruleName: string,
  message: string,
  currentValue?: string | number,
  limitValue?: string | number,
): RiskDecision {
  return {
    status: 'reject',
    violations: [{
      ruleId,
      ruleName,
      severity: 'error',
      message,
      currentValue,
      limitValue,
    }],
    warnings: [],
    score: 0,
  }
}

/** Check if an order exceeds max position size considering existing position */
export function computeRequiredMargin(
  quantity: number,
  price: number,
  leverage: number,
): number {
  if (leverage <= 0) return quantity * price
  return (quantity * price) / leverage
}

/** Format a numeric value for violation messages */
export function fmt(val: number, decimals = 2): string {
  return val.toFixed(decimals)
}
