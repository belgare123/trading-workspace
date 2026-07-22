// src/event-journal/SnapshotMetrics.ts
// Phase 4.4 — Concrete metrics collector for snapshots
// In-memory counters and histograms. Compatible with Prometheus/OTel export.

import type { SnapshotMetricsCollector } from './SnapshotManager'

export interface SnapshotMetricSnapshot {
  createTotal: number
  createTotalByPriority: Record<string, number>
  restoreTotal: number
  restoreTotalBySource: Record<string, number>
  validationFailedTotal: number
  validationFailedByReason: Record<string, number>
  prunedTotal: number
  durationMs: number[]
  restoreDurationMs: number[]
  sizeBytes: number[]
}

export class SnapshotMetrics implements SnapshotMetricsCollector {
  private _createTotal = 0
  private _createTotalByPriority: Record<string, number> = {}
  private _restoreTotal = 0
  private _restoreTotalBySource: Record<string, number> = {}
  private _validationFailedTotal = 0
  private _validationFailedByReason: Record<string, number> = {}
  private _prunedTotal = 0
  private _durationMs: number[] = []
  private _restoreDurationMs: number[] = []
  private _sizeBytes: number[] = []

  readonly maxObservations = 1000

  incCreateTotal(priority: string): void {
    this._createTotal++
    this._createTotalByPriority[priority] = (this._createTotalByPriority[priority] ?? 0) + 1
  }

  incRestoreTotal(source: 'latest' | 'aggregate'): void {
    this._restoreTotal++
    this._restoreTotalBySource[source] = (this._restoreTotalBySource[source] ?? 0) + 1
  }

  incValidationFailed(reason: string): void {
    this._validationFailedTotal++
    this._validationFailedByReason[reason] = (this._validationFailedByReason[reason] ?? 0) + 1
  }

  observeDuration(ms: number): void {
    this._durationMs.push(ms)
    if (this._durationMs.length > this.maxObservations) {
      this._durationMs.shift()
    }
  }

  observeRestoreDuration(ms: number): void {
    this._restoreDurationMs.push(ms)
    if (this._restoreDurationMs.length > this.maxObservations) {
      this._restoreDurationMs.shift()
    }
  }

  observeSizeBytes(bytes: number): void {
    this._sizeBytes.push(bytes)
    if (this._sizeBytes.length > this.maxObservations) {
      this._sizeBytes.shift()
    }
  }

  incPrunedTotal(count: number): void {
    this._prunedTotal += count
  }

  /** Average of an array, 0 if empty */
  private avg(arr: number[]): number {
    if (arr.length === 0) return 0
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }

  /** P50 (median) */
  private p50(arr: number[]): number {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 0 && mid > 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2
    }
    return sorted[mid]
  }

  /** P99 estimate */
  private p99(arr: number[]): number {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.99)]
  }

  /** Snapshot of current metrics for export/health */
  snapshot(): SnapshotMetricSnapshot {
    return {
      createTotal: this._createTotal,
      createTotalByPriority: { ...this._createTotalByPriority },
      restoreTotal: this._restoreTotal,
      restoreTotalBySource: { ...this._restoreTotalBySource },
      validationFailedTotal: this._validationFailedTotal,
      validationFailedByReason: { ...this._validationFailedByReason },
      prunedTotal: this._prunedTotal,
      durationMs: [...this._durationMs],
      restoreDurationMs: [...this._restoreDurationMs],
      sizeBytes: [...this._sizeBytes],
    }
  }

  /** Reset all metrics */
  reset(): void {
    this._createTotal = 0
    this._createTotalByPriority = {}
    this._restoreTotal = 0
    this._restoreTotalBySource = {}
    this._validationFailedTotal = 0
    this._validationFailedByReason = {}
    this._prunedTotal = 0
    this._durationMs = []
    this._restoreDurationMs = []
    this._sizeBytes = []
  }

  // ─── Aggregated getters ───

  get createTotal(): number { return this._createTotal }
  get restoreTotal(): number { return this._restoreTotal }
  get validationFailedTotal(): number { return this._validationFailedTotal }
  get prunedTotal(): number { return this._prunedTotal }
  get avgDurationMs(): number { return this.avg(this._durationMs) }
  get avgRestoreDurationMs(): number { return this.avg(this._restoreDurationMs) }
  get avgSizeBytes(): number { return this.avg(this._sizeBytes) }
  get p50DurationMs(): number { return this.p50(this._durationMs) }
  get p99DurationMs(): number { return this.p99(this._durationMs) }
}
