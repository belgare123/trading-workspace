// src/event-journal/SnapshotHealth.ts
// Phase 4.5 — Health report for snapshots. Plugs into HealthAggregator.

import type { IEventJournal } from './IEventJournal'
import type { SnapshotMetrics } from './SnapshotMetrics'
import type { SnapshotValidator, ValidationResult } from './SnapshotValidator'

export interface SnapshotHealthReport {
  healthy: boolean
  lastSnapshotAge: number
  lastSnapshotSequence: number
  validation: 'ok' | 'warning' | 'error'
  snapshotCount: number
  metrics: {
    createTotal: number
    restoreTotal: number
    validationFailedTotal: number
    prunedTotal: number
    avgDurationMs: number
    p50DurationMs: number
    p99DurationMs: number
  }
  warnings: string[]
  errors: string[]
}

export class SnapshotHealth {
  private journal: IEventJournal
  private metrics?: SnapshotMetrics
  private validator?: SnapshotValidator

  constructor(
    journal: IEventJournal,
    metrics?: SnapshotMetrics,
    validator?: SnapshotValidator,
  ) {
    this.journal = journal
    this.metrics = metrics
    this.validator = validator
  }

  /** Generate a health report for the snapshot subsystem */
  report(): SnapshotHealthReport {
    const warnings: string[] = []
    const errors: string[] = []

    // Gather snapshot info
    const aggregateIds = this.journal.listAggregateIds()
    const snapshotCount = aggregateIds.length
    const lastAppliedSequence = this.journal.getLastAppliedSequence()

    // Calculate age of latest snapshot
    let lastSnapshotAge = 0
    let lastSnapshotSequence = 0
    let oldestSnapshotAge = 0

    for (const id of aggregateIds) {
      const snap = this.journal.loadSnapshot(id)
      if (snap) {
        const age = Date.now() - snap.created_at
        if (age > oldestSnapshotAge) oldestSnapshotAge = age
        if (age < lastSnapshotAge || lastSnapshotAge === 0) lastSnapshotAge = age
        if (snap.sequence > lastSnapshotSequence) lastSnapshotSequence = snap.sequence
      }
    }

    // Validation checks
    let validation: 'ok' | 'warning' | 'error' = 'ok'

    if (snapshotCount === 0) {
      warnings.push('No snapshots exist — recovery will require full journal replay')
      validation = 'warning'
    }

    // Check for stale snapshots (> 1 hour without a new one)
    if (lastSnapshotAge > 3_600_000 && snapshotCount > 0) {
      warnings.push(`Latest snapshot is ${Math.floor(lastSnapshotAge / 1000)}s old`)
      if (validation === 'ok') validation = 'warning'
    }

    // Run validator on each snapshot
    if (this.validator) {
      let validationErrors = 0
      for (const id of aggregateIds) {
        const snap = this.journal.loadSnapshot(id)
        if (snap) {
          const result = this.validator.validate(snap)
          if (!result.valid) {
            validationErrors++
            errors.push(...result.errors.map(e => `[${id}] ${e}`))
          }
        }
      }
      if (validationErrors > 0) {
        validation = 'error'
      }
    }

    // Build metrics summary
    const metrics = {
      createTotal: this.metrics?.createTotal ?? 0,
      restoreTotal: this.metrics?.restoreTotal ?? 0,
      validationFailedTotal: this.metrics?.validationFailedTotal ?? 0,
      prunedTotal: this.metrics?.prunedTotal ?? 0,
      avgDurationMs: this.metrics?.avgDurationMs ?? 0,
      p50DurationMs: this.metrics?.p50DurationMs ?? 0,
      p99DurationMs: this.metrics?.p99DurationMs ?? 0,
    }

    return {
      healthy: errors.length === 0,
      lastSnapshotAge,
      lastSnapshotSequence,
      validation,
      snapshotCount,
      metrics,
      warnings,
      errors,
    }
  }
}
