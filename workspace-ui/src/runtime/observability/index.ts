/**
 * Observability — barrel exports
 *
 * Usage (preferred):
 *   import { observability, getObservability } from '../observability'
 *   observability.logger.info({ message: 'Hello' })
 *
 * Usage (per-module logger):
 *   import { StructuredLogger } from '../observability'
 *   const log = new StructuredLogger('gateway')
 *
 * @since 6.1.0
 */

export { ObservabilityRuntime, getObservability, observability } from './ObservabilityRuntime'
export type { ObservabilityConfig } from './ObservabilityRuntime'

export { CorrelationContext } from './CorrelationContext'
export type { TraceSpan, TraceContext, Milestone } from './CorrelationContext'

export { StructuredLogger, LogLevel, setDefaultLogger, getLogger } from './StructuredLogger'
export type { LogLevelValue, LogLevelName, LogEntry, LogTransport } from './StructuredLogger'

export { MetricsRegistry } from './MetricsRegistry'
export type { Counter, Gauge, Histogram, MetricLabel, MetricsSnapshot } from './MetricsRegistry'

export { HealthAggregator } from './HealthAggregator'
export type { HealthCheckResult, HealthCheckFn, RegisteredCheck, WorkspaceHealthSnapshot } from './HealthAggregator'

export { EventTracer } from './EventTracer'
export type { TraceEvent, Timeline } from './EventTracer'

export { AlertEngine } from './AlertEngine'
export type { AlertRule, AlertEvent, AlertSeverity, AlertNotifyFn } from './AlertEngine'

export { setupEventBusObservability, registerEventBusHealth } from './EventBusMiddleware'

export { setupObservability, patchConsole } from './ObservabilitySetup'
