/**
 * FinalGate.ts — Aggregate campaign results into a GO/ROLLBACK decision
 *
 * Sprint 6.6.6 — Full Chaos Campaign (Block 7)
 *
 * After all campaigns, the Final Gate evaluates the aggregate results
 * and produces a single GO or ROLLBACK decision.
 *
 * @since 6.6.6
 */

import type { CampaignReport } from './CampaignEngine'

// ── Types ──

export type GateDecision = 'GO' | 'ROLLBACK'

export interface FinalGateResult {
  decision: GateDecision
  timestamp: string
  campaigns: number
  totalAssertions: number
  passedAssertions: number
  failedAssertions: number
  failedCampaigns: string[]
  sloViolations: number
  summary: string
}

export interface FinalGateConfig {
  /** Fail on any SLO violation (default: false) */
  failOnSloViolation?: boolean
  /** Fail on any assertion failure (default: true) */
  failOnAssertionFailure?: boolean
  /** Max allowed SLO violations before ROLLBACK (default: 0) */
  maxSloViolations?: number
  /** Max allowed failed assertions before ROLLBACK (default: 0) */
  maxFailedAssertions?: number
}

// ════════════════════════════════════════════
// Final Gate Evaluator
// ════════════════════════════════════════════

export class FinalGate {
  private reports: CampaignReport[]

  constructor(reports: CampaignReport[]) {
    this.reports = reports
  }

  /**
   * Evaluate all campaign reports and produce a GO/ROLLBACK decision.
   */
  evaluate(config?: FinalGateConfig): FinalGateResult {
    const cfg: Required<FinalGateConfig> = {
      failOnSloViolation: false,
      failOnAssertionFailure: true,
      maxSloViolations: 0,
      maxFailedAssertions: 0,
      ...config,
    }

    const timestamp = new Date().toISOString()
    const totalCampaigns = this.reports.length
    let totalAssertions = 0
    let passedAssertions = 0
    let failedAssertions = 0
    let totalSloViolations = 0
    const failedCampaigns: string[] = []

    for (const report of this.reports) {
      totalAssertions += report.totalAssertions
      passedAssertions += report.passedAssertions
      failedAssertions += report.failedAssertions
      totalSloViolations += report.sloResults.filter(s => !s.pass).length

      if (!report.allPass) {
        failedCampaigns.push(report.name)
      }
    }

    // Determine decision
    let decision: GateDecision = 'GO'
    const reasons: string[] = []

    if (cfg.failOnAssertionFailure && failedAssertions > cfg.maxFailedAssertions) {
      decision = 'ROLLBACK'
      reasons.push(`${failedAssertions} assertion failures (max: ${cfg.maxFailedAssertions})`)
    }

    if (cfg.failOnSloViolation && totalSloViolations > cfg.maxSloViolations) {
      decision = 'ROLLBACK'
      reasons.push(`${totalSloViolations} SLO violations (max: ${cfg.maxSloViolations})`)
    }

    if (failedCampaigns.length > 0 && cfg.failOnAssertionFailure) {
      decision = 'ROLLBACK'
      reasons.push(`Failed campaigns: ${failedCampaigns.join(', ')}`)
    }

    const summary = decision === 'GO'
      ? `All ${totalCampaigns} campaigns passed. Chaos Runtime v1.0 certified.`
      : `ROLLBACK: ${reasons.join('; ')}`

    return {
      decision,
      timestamp,
      campaigns: totalCampaigns,
      totalAssertions,
      passedAssertions,
      failedAssertions,
      failedCampaigns,
      sloViolations: totalSloViolations,
      summary,
    }
  }

  /**
   * Generates a human-readable gate report.
   */
  report(config?: FinalGateConfig): string {
    const result = this.evaluate(config)
    const lines: string[] = [
      '╔══════════════════════════════════════╗',
      '║  Final Gate — Certification Summary  ║',
      '╚══════════════════════════════════════╝',
      '',
      `Campaigns:           ${result.campaigns}`,
      `Assertions:          ${result.totalAssertions}`,
      `  Passed:            ${result.passedAssertions}`,
      `  Failed:            ${result.failedAssertions}`,
      `SLO violations:      ${result.sloViolations}`,
      `Failed campaigns:    ${result.failedCampaigns.length === 0 ? 'none' : result.failedCampaigns.join(', ')}`,
      '',
      `Decision:            ${result.decision === 'GO' ? '✅ GO' : '❌ ROLLBACK'}`,
      '',
      result.summary,
      '',
    ]
    return lines.join('\n')
  }
}
