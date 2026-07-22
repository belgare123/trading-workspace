/**
 * TelemetryExporter.ts — Abstract base for all metric exporters
 *
 * Every exporter extends this base and implements:
 *   - exportAll(snapshot) — push full snapshot to target
 *   - health() — exporter health status
 *   - name — unique exporter name for registry
 *
 * The ExporterRegistry calls exportAll on all registered exporters
 * on a schedule. Exporters never pull from RuntimeTelemetry directly —
 * they receive the snapshot from the registry.
 *
 * @since 6.4.0
 */

import type { SliSystemSnapshot } from '../../../workspace/live/sli/SliTypes'

/* ── Exporter Health ── */

export interface ExporterHealth {
  /** Exporter name */
  name: string
  /** Is the exporter healthy and connected? */
  healthy: boolean
  /** Timestamp of last successful export */
  lastExport: number
  /** Number of metrics in last export */
  lastMetricCount: number
  /** Queue depth (metrics waiting to be pushed) */
  queueDepth: number
  /** Number of dropped metrics since start */
  droppedMetrics: number
  /** Human-readable status message */
  message?: string
}

/* ── Base class ── */

export abstract class TelemetryExporter {
  /** Unique exporter name */
  abstract readonly name: string

  /** Export a complete SLI system snapshot to the target backend */
  abstract exportAll(snapshot: SliSystemSnapshot): Promise<void> | void

  /** Return current health status */
  abstract health(): ExporterHealth

  /** Graceful shutdown (flush + close connections) */
  async shutdown(): Promise<void> {
    // Default: no-op
  }
}
