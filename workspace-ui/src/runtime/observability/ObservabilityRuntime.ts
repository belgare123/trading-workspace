/**
 * ObservabilityRuntime — singleton facade over all observability subsystems.
 *
 * This is the single entry point for all observability concerns in the platform.
 * Every module accesses it through the singleton (or via dependency injection).
 *
 * Usage:
 *   import { observability } from '../../runtime/observability'
 *
 *   observability.logger.info({ message: 'Strategy started', strategyId })
 *   observability.metrics.counter('signals_total').inc()
 *   observability.tracer.record(traceId, 'strategy', 'Signal generated')
 *   observability.health.register('strategy', () => ({ healthy: true }))
 *
 * @since 6.1.0
 */

import { CorrelationContext, type TraceContext, _setLoggerRef } from './CorrelationContext'
import { StructuredLogger, type LogEntry, setDefaultLogger } from './StructuredLogger'
import { MetricsRegistry, type MetricsSnapshot } from './MetricsRegistry'
import { HealthAggregator, type WorkspaceHealthSnapshot } from './HealthAggregator'
import { EventTracer, type Timeline } from './EventTracer'
import { AlertEngine, type AlertEvent, type AlertRule } from './AlertEngine'

/* ── ObservabilityConfig ── */

export interface ObservabilityConfig {
  /** Module name (sets default logger module) */
  module?: string
  /** Minimum log level (default: debug) */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  /** Enable event tracing (default: true) */
  enableTracing?: boolean
  /** Enable alert engine evaluation (default: true) */
  enableAlerts?: boolean
  /** Periodic health check interval in ms (default: 30000 = 30s) */
  healthIntervalMs?: number
  /** Periodic alert evaluation interval in ms (default: 10000 = 10s) */
  alertIntervalMs?: number
}

/* ── Facade ── */

export class ObservabilityRuntime {
  readonly logger: StructuredLogger
  readonly metrics: MetricsRegistry
  readonly health: HealthAggregator
  readonly tracer: EventTracer
  readonly alerts: AlertEngine
  readonly correlation: typeof CorrelationContext = CorrelationContext

  private _healthTimer: ReturnType<typeof setInterval> | null = null
  private _alertTimer: ReturnType<typeof setInterval> | null = null
  private _config: Required<ObservabilityConfig>
  private _startedAt = Date.now()

  constructor(config: ObservabilityConfig = {}) {
    this._config = {
      module: config.module ?? 'observability',
      logLevel: config.logLevel ?? 'debug',
      enableTracing: config.enableTracing ?? true,
      enableAlerts: config.enableAlerts ?? true,
      healthIntervalMs: config.healthIntervalMs ?? 30_000,
      alertIntervalMs: config.alertIntervalMs ?? 10_000,
    }

    this.logger = new StructuredLogger(this._config.module)
    this.metrics = new MetricsRegistry()
    this.health = new HealthAggregator()
    this.tracer = new EventTracer()
    this.alerts = new AlertEngine()

    // Set as defaults
    setDefaultLogger(this.logger)
    _setLoggerRef(this.logger)

    // Register observability module health
    this.health.register('observability', () => ({
      healthy: true,
      latency_ms: Date.now() - this._startedAt < 60_000 ? 0 : 1,
      uptime_seconds: this.uptimeSeconds,
    }))

    // Wire alerts to logger
    this.alerts.onAlert((event: AlertEvent) => {
      this.logger.info({
        message: `[ALERT] ${event.severity.toUpperCase()}: ${event.summary}`,
        alert: event.ruleName,
        severity: event.severity,
        status: event.status,
        value: event.value,
      })
    })

    // Start periodic evaluations
    if (this._config.enableAlerts) {
      this._startAlertLoop()
    }
  }

  /* ── Trace helpers ── */

  /** Start a new trace (convenience) */
  startTrace(type: string, label?: string): TraceContext {
    const ctx = this.correlation.start(type, label)
    if (this._config.enableTracing) {
      this.tracer.record(ctx.span.id, 'start', `${type}: ${label ?? ''}`)
    }
    return ctx
  }

  /** Record a milestone on a trace (convenience) */
  recordTrace(traceId: string, stage: string, label: string, data?: Record<string, unknown>): void {
    if (this._config.enableTracing) {
      this.tracer.record(traceId, stage, label, data)
    }
  }

  /* ── Health snapshot ── */

  /** Get full health snapshot */
  async healthSnapshot(): Promise<WorkspaceHealthSnapshot> {
    const snap = await this.health.snapshot()
    // Attach metrics
    return snap
  }

  /* ── Metrics ── */

  /** Get full metrics snapshot */
  metricsSnapshot(): MetricsSnapshot {
    return this.metrics.snapshot()
  }

  /** Prometheus-formatted metrics text */
  metricsText(): string {
    return this.metrics.prometheusText()
  }

  /* ── Timelines ── */

  /** Get timeline for a specific trace */
  getTimeline(traceId: string): Timeline | null {
    return this.tracer.getTimeline(traceId)
  }

  /** Get recent timelines */
  getRecentTimelines(limit = 20): Timeline[] {
    return this.tracer.getRecentTimelines(limit)
  }

  /* ── Alerts ── */

  /** Add an alert rule */
  addAlertRule(rule: AlertRule): void {
    this.alerts.addRule(rule)
  }

  /** Evaluate alert rules manually */
  async evaluateAlerts(): Promise<AlertEvent[]> {
    return this.alerts.evaluate()
  }

  /* ── Lifecycle ── */

  get uptimeSeconds(): number {
    return Math.floor((Date.now() - this._startedAt) / 1000)
  }

  /** Start periodic health checks */
  startHealthLoop(intervalMs?: number): void {
    if (this._healthTimer) clearInterval(this._healthTimer)
    this._healthTimer = setInterval(async () => {
      await this.health.snapshot()
    }, intervalMs ?? this._config.healthIntervalMs)
  }

  /** Stop periodic loops */
  stop(): void {
    if (this._healthTimer) clearInterval(this._healthTimer)
    if (this._alertTimer) clearInterval(this._alertTimer)
    this._healthTimer = null
    this._alertTimer = null
  }

  /* ── Private ── */

  private _startAlertLoop(): void {
    this._alertTimer = setInterval(async () => {
      try {
        await this.alerts.evaluate()
      } catch (err) {
        this.logger.error('Alert evaluation failed', { error: String(err) })
      }
    }, this._config.alertIntervalMs)
  }

  /** Reset the runtime (for testing) */
  static reset(): void {
    _globalInstance = null
  }
}

/* ── Global singleton ── */

let _globalInstance: ObservabilityRuntime | null = null

/** Get or create the global ObservabilityRuntime. Created once, used everywhere. */
export function getObservability(config?: ObservabilityConfig): ObservabilityRuntime {
  if (!_globalInstance) {
    _globalInstance = new ObservabilityRuntime(config)
  }
  return _globalInstance
}

/** Convenience export for direct use: import { observability } from ... */
export const observability: ObservabilityRuntime = new Proxy(
  {} as ObservabilityRuntime,
  {
    get(_target, prop: keyof ObservabilityRuntime) {
      return getObservability()[prop]
    },
  },
)
