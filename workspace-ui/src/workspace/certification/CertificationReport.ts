/**
 * CertificationReport.ts — Builds a structured report from scenario results
 *
 * @since 4.9
 */

import type { ScenarioResult, ScenarioCategory } from './ScenarioDefinition'
import { ALL_CATEGORIES } from './ScenarioDefinition'

// ═══════════════════════════════════════════════
// Report Types
// ═══════════════════════════════════════════════

export interface CategorySummary {
  total: number
  passed: number
  failed: number
  skipped: number
  errors: number
  /** Duration in ms (sum of passed) */
  durationMs: number
}

export interface CertificationReport {
  /** ISO timestamp */
  timestamp: string
  /** Total scenarios */
  total: number
  /** Passed count */
  passed: number
  /** Failed count */
  failed: number
  /** Skipped count */
  skipped: number
  /** Error count (unhandled exceptions) */
  errors: number
  /** Overall pass rate (0–100) */
  passRate: number
  /** Whether all sceanrios passed (no failures/errors) */
  allPassed: boolean
  /** Duration in ms */
  durationMs: number
  /** Summary by category */
  categories: Record<ScenarioCategory, CategorySummary>
  /** Detailed results */
  details: ScenarioResult[]
  /** Failed results (filtered) */
  failures: ScenarioResult[]
}

// ═══════════════════════════════════════════════
// Report Builder
// ═══════════════════════════════════════════════

export class CertificationReportBuilder {
  private startTime = 0

  start(): void {
    this.startTime = performance.now()
  }

  build(results: ScenarioResult[]): CertificationReport {
    const details = [...results]
    const failures = details.filter(
      (r) => r.outcome.verdict === 'failed' || r.outcome.verdict === 'error',
    )

    const passed = details.filter((r) => r.outcome.verdict === 'passed').length
    const failed = details.filter((r) => r.outcome.verdict === 'failed').length
    const skipped = details.filter((r) => r.outcome.verdict === 'skipped').length
    const errors = details.filter((r) => r.outcome.verdict === 'error').length
    const total = details.length

    const durationMs = Math.round(performance.now() - this.startTime)

    // Per-category summary
    const categories: Record<string, CategorySummary> = {}
    for (const cat of ALL_CATEGORIES) {
      const catResults = details.filter((r) => r.definition.category === cat)
      categories[cat] = {
        total: catResults.length,
        passed: catResults.filter((r) => r.outcome.verdict === 'passed').length,
        failed: catResults.filter((r) => r.outcome.verdict === 'failed').length,
        skipped: catResults.filter((r) => r.outcome.verdict === 'skipped').length,
        errors: catResults.filter((r) => r.outcome.verdict === 'error').length,
        durationMs: Math.round(
          catResults.reduce((s, r) => s + r.outcome.durationMs, 0),
        ),
      }
    }

    return {
      timestamp: new Date().toISOString(),
      total,
      passed,
      failed,
      skipped,
      errors,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 100,
      allPassed: failed === 0 && errors === 0,
      durationMs,
      categories: categories as Record<ScenarioCategory, CategorySummary>,
      details,
      failures,
    }
  }

  /** Format the report as a human-readable string */
  static format(report: CertificationReport): string {
    const lines: string[] = []
    lines.push('')
    lines.push('  ╔══════════════════════════════════════╗')
    lines.push('  ║      Certification Report           ║')
    lines.push('  ╚══════════════════════════════════════╝')
    lines.push('')
    lines.push(`  ${report.timestamp}`)
    lines.push(`  Duration: ${report.durationMs}ms`)
    lines.push('')

    // Category table
    const header = '  │ Category        │ Total │ Pass │ Fail │ Skip │ Err  │'
    const separator = '  ├─────────────────┼───────┼──────┼──────┼──────┼──────┤'
    lines.push(separator)
    lines.push(header)
    lines.push(separator)

    for (const [cat, summary] of Object.entries(report.categories)) {
      const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1)
      const check = summary.passed === summary.total && summary.total > 0 ? '✅' : '❌'
      lines.push(
        `  │ ${check} ${catLabel.padEnd(14)}│ ${String(summary.total).padStart(5)} │ ${String(summary.passed).padStart(4)} │ ${String(summary.failed).padStart(4)} │ ${String(summary.skipped).padStart(4)} │ ${String(summary.errors).padStart(4)} │`,
      )
    }

    lines.push(
      `  ├─────────────────┼───────┼──────┼──────┼──────┼──────┤`,
    )
    lines.push(
      `  │ ${report.allPassed ? '✅' : '❌'} TOTAL${' '.padEnd(13)}│ ${String(report.total).padStart(5)} │ ${String(report.passed).padStart(4)} │ ${String(report.failed).padStart(4)} │ ${String(report.skipped).padStart(4)} │ ${String(report.errors).padStart(4)} │`,
    )
    lines.push(separator)
    lines.push('')

    if (report.failures.length > 0) {
      lines.push('  ── Failures ──')
      for (const f of report.failures) {
        lines.push(`  ❌ ${f.definition.id}: ${f.outcome.message}`)
        if (f.outcome.error) {
          lines.push(`     ${f.outcome.error}`)
        }
      }
      lines.push('')
      lines.push(`  Pass rate: ${report.passRate}%`)
      lines.push(`  Result: ${report.allPassed ? '✅ PASSED' : '❌ FAILED'}`)
    } else {
      lines.push(`  🎉 All ${report.total} scenarios passed!`)
    }

    lines.push('')
    return lines.join('\n')
  }

  /** Format the report as JSON */
  static toJson(report: CertificationReport): string {
    return JSON.stringify(report, null, 2)
  }
}
