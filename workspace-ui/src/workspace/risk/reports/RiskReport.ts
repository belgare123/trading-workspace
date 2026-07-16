/**
 * RiskReport.ts — Aggregate risk statistics and reports
 *
 * @since 4.7
 */

import type { KillSwitchState } from '../types'
import { RiskViolationLog } from './RiskViolationLog'

export interface RiskSummary {
  totalViolations: number
  todayViolations: number
  rejectedOrders: number
  modifiedOrders: number
  allowedOrders: number
  killSwitchActive: boolean
  topRules: { ruleId: string; count: number }[]
  topStrategies: { strategyId: string; count: number }[]
}

export class RiskReport {
  static generate(log: RiskViolationLog, killSwitch?: KillSwitchState): RiskSummary {
    const entries = log.export()

    const rejectedOrders = entries.filter(e => e.decision === 'reject').length
    const modifiedOrders = entries.filter(e => e.decision === 'modify').length
    const allowedOrders = entries.filter(e => e.decision === 'allow').length

    // Per-rule counts
    const ruleCounts = new Map<string, number>()
    for (const e of entries) {
      ruleCounts.set(e.ruleId, (ruleCounts.get(e.ruleId) ?? 0) + 1)
    }
    const topRules = Array.from(ruleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ruleId, count]) => ({ ruleId, count }))

    // Per-strategy counts
    const strategyCounts = new Map<string, number>()
    for (const e of entries) {
      strategyCounts.set(e.strategyId, (strategyCounts.get(e.strategyId) ?? 0) + 1)
    }
    const topStrategies = Array.from(strategyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([strategyId, count]) => ({ strategyId, count }))

    return {
      totalViolations: entries.length,
      todayViolations: Number(log.today()),
      rejectedOrders,
      modifiedOrders,
      allowedOrders,
      killSwitchActive: killSwitch?.active ?? false,
      topRules,
      topStrategies,
    }
  }
}
