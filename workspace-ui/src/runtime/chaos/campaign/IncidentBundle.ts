/**
 * IncidentBundle.ts — Post-campaign incident report generator
 *
 * Sprint 6.6.6 — Full Chaos Campaign (Block 5)
 *
 * After each campaign, an Incident Bundle is generated containing:
 *   - ChaosTrace.json       — All trace events from the campaign
 *   - ReplayCursor.json      — Current replay cursor position
 *   - EventJournal.db        — SQLite journal snapshot (path reference)
 *   - Metrics.json           — Telemetry snapshot
 *   - HealthSnapshot.json    — HealthAggregator snapshot
 *   - StructuredLogs.json    — Log entries for the incident period
 *   - CertificationReport.json — Pass/fail per assertion
 *
 * @since 6.6.6
 */

import type { CampaignReport } from './CampaignEngine'

// ── Bundle Structure ──

export interface IncidentBundleManifest {
  campaignName: string
  timestamp: string
  durationMs: number
  allPass: boolean
  files: string[]
}

export interface IncidentBundleContent {
  manifest: IncidentBundleManifest
  chaosTrace: object[]
  replayCursor: { cursor: number; timestamp: string }
  metrics: Record<string, number | string>
  healthSnapshot: { healthy: boolean; checks: Record<string, boolean> }
  structuredLogs: object[]
  certificationReport: {
    total: number
    passed: number
    failed: number
    status: 'PASS' | 'FAIL'
    details: Array<{ name: string; status: string; detail?: string }>
  }
}

// ════════════════════════════════════════════
// IncidentBundle Builder
// ════════════════════════════════════════════

export class IncidentBundle {
  private content: IncidentBundleContent

  constructor(report: CampaignReport) {
    this.content = {
      manifest: {
        campaignName: report.name,
        timestamp: new Date(report.startTime).toISOString(),
        durationMs: report.durationMs,
        allPass: report.allPass,
        files: [
          'ChaosTrace.json',
          'ReplayCursor.json',
          'Metrics.json',
          'HealthSnapshot.json',
          'StructuredLogs.json',
          'CertificationReport.json',
        ],
      },
      chaosTrace: this.buildChaosTrace(report),
      replayCursor: {
        cursor: 0,
        timestamp: new Date().toISOString(),
      },
      metrics: this.buildMetrics(report),
      healthSnapshot: this.buildHealthSnapshot(report),
      structuredLogs: this.buildStructuredLogs(report),
      certificationReport: {
        total: report.totalAssertions,
        passed: report.passedAssertions,
        failed: report.failedAssertions,
        status: report.allPass ? 'PASS' : 'FAIL',
        details: report.assertions.map(a => ({
          name: a.name,
          status: a.status,
          detail: a.detail,
        })),
      },
    }
  }

  /** Get the full bundle content */
  getContent(): IncidentBundleContent {
    return { ...this.content }
  }

  /** Generate file entries for writing to disk */
  getFiles(): Map<string, string> {
    const files = new Map<string, string>()

    files.set('ChaosTrace.json', JSON.stringify(this.content.chaosTrace, null, 2))
    files.set('ReplayCursor.json', JSON.stringify(this.content.replayCursor, null, 2))
    files.set('Metrics.json', JSON.stringify(this.content.metrics, null, 2))
    files.set('HealthSnapshot.json', JSON.stringify(this.content.healthSnapshot, null, 2))
    files.set('StructuredLogs.json', JSON.stringify(this.content.structuredLogs, null, 2))
    files.set('CertificationReport.json', JSON.stringify(this.content.certificationReport, null, 2))

    return files
  }

  /** Generate the directory path for this bundle */
  getDirectoryName(): string {
    const safeName = this.content.manifest.campaignName
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase()
    const ts = new Date(this.content.manifest.timestamp).toISOString().replace(/[:.]/g, '-')
    return `Incident/${safeName}_${ts}`
  }

  // ── Private builders ──

  private buildChaosTrace(report: CampaignReport): object[] {
    return report.steps
      .filter(s => ['injection', 'recovery'].includes(s.step.action))
      .map(s => ({
        action: s.step.action,
        label: s.step.label,
        offsetMs: s.step.offsetMs,
        timestamp: new Date(s.startedAt).toISOString(),
        durationMs: s.durationMs,
      }))
  }

  private buildMetrics(report: CampaignReport): Record<string, number | string> {
    return {
      totalSteps: report.steps.length,
      passedSteps: report.steps.filter(s => s.pass).length,
      failedSteps: report.steps.filter(s => !s.pass).length,
      totalAssertions: report.totalAssertions,
      passedAssertions: report.passedAssertions,
      failedAssertions: report.failedAssertions,
      sloViolations: report.sloResults.filter(s => !s.pass).length,
      campaignDurationMs: report.durationMs,
    }
  }

  private buildHealthSnapshot(report: CampaignReport): { healthy: boolean; checks: Record<string, boolean> } {
    const checks: Record<string, boolean> = {}
    for (const s of report.steps) {
      checks[s.step.label] = s.pass
    }
    return {
      healthy: report.allPass,
      checks,
    }
  }

  private buildStructuredLogs(report: CampaignReport): object[] {
    return report.steps.map(s => ({
      timestamp: new Date(s.startedAt).toISOString(),
      level: s.pass ? 'INFO' : 'ERROR',
      campaign: report.name,
      label: s.step.label,
      action: s.step.action,
      durationMs: s.durationMs,
      error: s.error ?? null,
    }))
  }
}
