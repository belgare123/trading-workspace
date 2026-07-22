/**
 * ExporterRegistry.ts — Central registry for all metric exporters
 *
 * Manages:
 *   - Registration of TelemetryExporter instances
 *   - Periodic push of RuntimeTelemetry snapshots to all exporters
 *   - Aggregate health status
 *   - Graceful shutdown
 *
 * The registry is the ONLY component that calls exportAll() on exporters.
 * This ensures every exporter receives the same snapshot, at the same time.
 *
 * @since 6.4.0
 */

import { TelemetryExporter, type ExporterHealth } from './TelemetryExporter'
import type { SliSystemSnapshot } from '../../../workspace/live/sli/SliTypes'
import { RuntimeTelemetry } from '../../../workspace/live/sli/RuntimeTelemetry'

/* ── Config ── */

export interface ExporterRegistryConfig {
  /** Export interval in milliseconds (default: 15000) */
  pushIntervalMs: number
}

const DEFAULT_CONFIG: ExporterRegistryConfig = {
  pushIntervalMs: 15_000,
}

/* ── Registry ── */

export class ExporterRegistry {
  private readonly exporters = new Map<string, TelemetryExporter>()
  private readonly config: ExporterRegistryConfig
  private timer: ReturnType<typeof setInterval> | null = null
  private _lastPushTime = 0
  private _pushCount = 0

  constructor(config?: Partial<ExporterRegistryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** Register an exporter */
  register(exporter: TelemetryExporter): void {
    if (this.exporters.has(exporter.name)) {
      throw new Error(`Exporter already registered: ${exporter.name}`)
    }
    this.exporters.set(exporter.name, exporter)
  }

  /** Unregister an exporter */
  unregister(name: string): boolean {
    return this.exporters.delete(name)
  }

  /** Get registered exporter by name */
  get(name: string): TelemetryExporter | undefined {
    return this.exporters.get(name)
  }

  /** Get all registered exporters */
  getAll(): TelemetryExporter[] {
    return Array.from(this.exporters.values())
  }

  /** Start periodic push */
  start(): void {
    if (this.timer) return
    // Do immediate first push
    this.push()
    this.timer = setInterval(() => this.push(), this.config.pushIntervalMs)
  }

  /** Stop periodic push */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Push current snapshot to all exporters */
  push(): void {
    const snapshot = RuntimeTelemetry.instance.snapshot()
    this.pushSnapshot(snapshot)
  }

  /** Push a specific snapshot to all exporters */
  pushSnapshot(snapshot: SliSystemSnapshot): void {
    for (const exporter of this.exporters.values()) {
      try {
        exporter.exportAll(snapshot)
      } catch (err) {
        console.error(`[ExporterRegistry] Export error (${exporter.name}):`, err)
      }
    }
    _lastPushTime = Date.now()
    _pushCount++
  }

  /** Aggregate health across all exporters */
  health(): ExporterHealth[] {
    return this.getAll().map(exporter => exporter.health())
  }

  /** Get aggregate health — true if ALL exporters are healthy */
  get aggregateHealthy(): boolean {
    const health = this.health()
    return health.length > 0 && health.every(h => h.healthy)
  }

  /** Number of registered exporters */
  get count(): number {
    return this.exporters.size
  }

  /** Graceful shutdown */
  async shutdown(): Promise<void> {
    this.stop()
    await Promise.all(this.getAll().map(e => e.shutdown()))
    this.exporters.clear()
  }
}

/* ── Global singleton ── */

export let exporterRegistry: ExporterRegistry = new ExporterRegistry()

/** Replace the global registry (for DI / testing) */
export function setExporterRegistry(registry: ExporterRegistry): void {
  exporterRegistry = registry
}

/* ── Internal state ── */

let _lastPushTime = 0
let _pushCount = 0

/** Exporter registry self-health (built-in) */
export function registryHealth(): ExporterHealth {
  return {
    name: 'registry',
    healthy: true,
    lastExport: _lastPushTime,
    lastMetricCount: exporterRegistry.count,
    queueDepth: 0,
    droppedMetrics: 0,
    message: `Push count: ${_pushCount}, exporters: ${exporterRegistry.count}`,
  }
}
