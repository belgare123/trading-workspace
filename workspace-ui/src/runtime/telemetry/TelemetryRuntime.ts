/**
 * TelemetryRuntime — dedicated runtime for the telemetry export pipeline.
 *
 * Wraps the entire telemetry export layer (MetricMapper, PrometheusExporter,
 * OpenTelemetryExporter, ExporterRegistry, ResourceAttributes, ExemplarStore)
 * as a first-class Runtime component with lifecycle, health checks, and
 * graceful shutdown.
 *
 * This makes the telemetry pipeline visible to HealthAggregator alongside
 * Gateway, Wallet, Trade, Risk, Strategy — so a failure to export metrics
 * is detectable even when trading continues normally.
 *
 * Usage:
 *   import { telemetryRuntime } from '../../runtime/telemetry'
 *   telemetryRuntime.start({ pushIntervalMs: 15_000 })
 *   // ...
 *   telemetryRuntime.stop()
 *
 * @since 6.4.0
 */

import {
  ExporterRegistry,
  exporterRegistry,
  initResourceAttributes,
  getResourceAttributes,
  mergeLabels,
  type ExporterRegistryConfig,
} from './export'

/* ── Config ── */

export interface TelemetryRuntimeConfig {
  /** Service name for resource labels (default: 'workspace-ui') */
  serviceName?: string
  /** Exchange identifier (default: 'unknown') */
  exchange?: string
  /** Trading symbol (default: 'unknown') */
  symbol?: string
  /** Environment tag (default: 'dev') */
  environment?: string
  /** Push interval in ms (default: 15_000 = 15s) */
  pushIntervalMs?: number
  /** Auto-start on construction (default: false) */
  autoStart?: boolean
}

/* ── Runtime ── */

export class TelemetryRuntime {
  readonly registry: ExporterRegistry

  private _config: Required<TelemetryRuntimeConfig>
  private _startedAt = 0
  private _running = false

  constructor(config: TelemetryRuntimeConfig = {}) {
    this._config = {
      serviceName: config.serviceName ?? 'workspace-ui',
      exchange: config.exchange ?? 'unknown',
      symbol: config.symbol ?? 'unknown',
      environment: config.environment ?? 'dev',
      pushIntervalMs: config.pushIntervalMs ?? 15_000,
      autoStart: config.autoStart ?? false,
    }

    this.registry = exporterRegistry

    // Initialise resource attributes
    initResourceAttributes({
      serviceName: this._config.serviceName,
      exchange: this._config.exchange,
      symbol: this._config.symbol,
      environment: this._config.environment,
    })

    if (this._config.autoStart) {
      this.start()
    }
  }

  /* ── Lifecycle ── */

  /** Start periodic export push */
  start(pushIntervalMs?: number): void {
    if (this._running) return
    this._startedAt = Date.now()
    this._running = true

    const interval = pushIntervalMs ?? this._config.pushIntervalMs
    this.registry.start(interval)
  }

  /** Stop telemetry export and clean up */
  stop(): void {
    if (!this._running) return
    this._running = false
    this.registry.stop()
  }

  /** Is the telemetry pipeline running? */
  get running(): boolean {
    return this._running
  }

  /** Uptime in seconds */
  get uptimeSeconds(): number {
    return this._startedAt > 0
      ? Math.floor((Date.now() - this._startedAt) / 1000)
      : 0
  }

  /* ── Health ── */

  /** Produce a health check result compatible with HealthAggregator */
  health(): TelemetryRuntimeHealth {
    const exportersHealth = this.registry.health()

    return {
      healthy: exportersHealth.length > 0 && exportersHealth.every(h => h.healthy),
      running: this._running,
      uptime_seconds: this.uptimeSeconds,
      started_at: this._startedAt > 0
        ? new Date(this._startedAt).toISOString()
        : undefined,
      exporter_count: exportersHealth.length,
      exporters: exportersHealth,
      resource_labels: mergeLabels({}),
    }
  }

  /* ── Convenience —─ */

  /** Get current resource labels */
  get resourceLabels(): Record<string, string> {
    return mergeLabels({})
  }

  /** Reset for testing */
  static reset(): void {
    _globalInstance = null
  }
}

/* ── Types ── */

export interface TelemetryRuntimeHealth {
  healthy: boolean
  running: boolean
  uptime_seconds: number
  started_at?: string
  exporter_count: number
  exporters: {
    name: string
    healthy: boolean
    lastExportTime: number
    lastMetricCount: number
    droppedCount: number
    exportTotal: number
  }[]
  resource_labels: Record<string, string>
  includeExemplars: boolean
}

/* ── Global singleton ── */

let _globalInstance: TelemetryRuntime | null = null

/** Get or create the global TelemetryRuntime singleton */
export function getTelemetryRuntime(config?: TelemetryRuntimeConfig): TelemetryRuntime {
  if (!_globalInstance) {
    _globalInstance = new TelemetryRuntime(config)
  }
  return _globalInstance
}

/** Convenience proxy for direct import: import { telemetryRuntime } from ... */
export const telemetryRuntime: TelemetryRuntime = new Proxy(
  {} as TelemetryRuntime,
  {
    get(_target, prop: keyof TelemetryRuntime) {
      return getTelemetryRuntime()[prop]
    },
  },
)
