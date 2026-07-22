// src/event-journal/SnapshotRecovery.ts
// Phase 4.3 → 5 — Recovery pipeline: load snapshots → validate → replay → report.
// ARCHITECTURE RULE: Event application is delegated to ReplayEngine.
// This class only orchestrates snapshot loading and validation.

import type { IEventJournal } from './IEventJournal'
import type { SnapshotManager } from './SnapshotManager'
import type { RecoveryReport } from './RecoveryReport'
import type { ReplayEngine } from './ReplayEngine'
import { replayOk } from './ReplayReport'

export { EventApplier } from './EventApplier'

/* ─── SnapshotRecovery ─── */

export class SnapshotRecovery {
  private journal: IEventJournal
  private snapshotManager: SnapshotManager
  private replayEngine: ReplayEngine

  constructor(
    journal: IEventJournal,
    snapshotManager: SnapshotManager,
    replayEngine: ReplayEngine,
  ) {
    this.journal = journal
    this.snapshotManager = snapshotManager
    this.replayEngine = replayEngine
  }

  /**
   * Full recovery pipeline:
   *   1. Load latest snapshots for all aggregates (via SnapshotManager)
   *   2. Validate each snapshot (via SnapshotManager)
   *   3. Replay events after last_applied_sequence (via ReplayEngine)
   *   4. Merge ReplayReport into RecoveryReport
   */
  async recover(): Promise<RecoveryReport> {
    // Step 1–2: Load and validate snapshots
    const report = this.snapshotManager.restoreLatest()

    // If nothing recovered or errors found, still try replay
    if (report.totalAggregates === 0 && report.errors.length > 0) {
      return report
    }

    // Step 3: Replay via ReplayEngine
    const cursor = report.lastAppliedSequence

    // Build initial states from recovered aggregates
    const initialStates = report.aggregates
      .filter(agg => agg.valid && agg.state !== null)
      .map(agg => ({
        aggregateId: agg.aggregateId,
        state: agg.state,
        sequence: agg.record.sequence,
      }))

    const replayed = await this.replayEngine.replay({
      initialStates: initialStates.length > 0 ? initialStates : undefined,
      fromSequence: cursor > 0 ? cursor : undefined,
      useCursor: true,
    })

    // Step 4: Merge ReplayReport into RecoveryReport
    report.replayedEvents = replayed.eventsProcessed
    report.replayDurationMs = replayed.replayDurationMs

    // Merge warnings and errors from replay
    for (const w of replayed.warnings) {
      if (!report.warnings.includes(w)) {
        report.warnings.push(w)
      }
    }
    for (const e of replayed.errors) {
      if (!report.errors.includes(e)) {
        report.errors.push(e)
      }
    }

    // Update aggregate states from replay results
    if (replayed.aggregateResults.length > 0) {
      for (const agg of report.aggregates) {
        const replayResult = replayed.aggregateResults.find(
          r => r.aggregateId === agg.aggregateId,
        )
        if (replayResult) {
          if (replayResult.eventsApplied > 0) {
            agg.record.sequence = replayResult.sequenceTo
          }
          // Update state from ReplayEngine (applier may return new object)
          if (replayResult.state !== undefined) {
            agg.state = replayResult.state
          }
        }
      }
    }

    // Update ok flag
    if (replayed.errors.length > 0 && report.ok) {
      report.ok = false
    }

    return report
  }
}
