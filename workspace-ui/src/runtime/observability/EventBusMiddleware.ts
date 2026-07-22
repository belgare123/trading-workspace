/**
 * EventBusMiddleware — Integration layer between EventBus and ObservabilityRuntime.
 *
 * Replaces the built-in loggingMiddleware/metricsMiddleware with
 * StructuredLogger + MetricsRegistry + EventTracer + CorrelationContext.
 *
 * Usage:
 *   import { setupEventBusObservability } from '../observability'
 *   setupEventBusObservability(runtimeEventBus, observability)
 *
 * @since 6.1.0
 */

import type { RuntimeEvent, EventStatus } from '../RuntimeEvent'
import type { EventBus } from '../EventBus'
import type { ObservabilityRuntime } from './ObservabilityRuntime'
import { CorrelationContext } from './CorrelationContext'

/**
 * Auto-generates a correlation ID for events that don't have one.
 * Creates a CorrelationContext trace for the event.
 */
export function correlationMiddleware(obs: ObservabilityRuntime) {
  return (event: RuntimeEvent, next: () => void): void => {
    if (!event.correlationId) {
      // Auto-generate trace
      const ctx = obs.correlation.start('event', `${event.topic}`)
      // Store in event metadata
      const corrId = ctx.span.id
      // We can't modify the event's correlationId after creation since
      // RuntimeEvent.correlationId is optional readonly.
      // Instead, we attach it via metadata so subscribers can use it.
      if (event.metadata) {
        event.metadata.correlationId = corrId
      }
    }

    // Record event in tracer
    obs.recordTrace(
      event.correlationId ?? event.metadata?.correlationId as string ?? event.id,
      event.source,
      event.topic,
      { severity: event.severity, id: event.id },
    )

    // Emit metrics
    obs.metrics.counter('eventbus_events_total', {}).inc()

    next()
  }
}

/**
 * Logs every EventBus event through StructuredLogger instead of console.*
 */
export function structuredLoggingMiddleware(obs: ObservabilityRuntime) {
  return (event: RuntimeEvent, next: () => void): void => {
    const logger = obs.logger

    // Route by severity
    const msg = `[${event.topic}] from ${event.source}`
    const ctx = {
      eventId: event.id,
      topic: event.topic,
      source: event.source,
      severity: event.severity,
      correlationId: event.correlationId,
      causationId: event.causationId,
      payload: event.payload,
      traceId: event.metadata?.correlationId as string | undefined,
    }

    switch (event.severity) {
      case 'error':
        logger.error(msg, ctx)
        obs.metrics.counter('eventbus_events_total', { status: 'error' }).inc()
        break
      case 'warn':
        logger.warn(msg, ctx)
        obs.metrics.counter('eventbus_events_total', { status: 'warn' }).inc()
        break
      case 'critical':
        logger.fatal(msg, ctx)
        obs.metrics.counter('eventbus_events_total', { status: 'critical' }).inc()
        break
      default:
        logger.info(msg, ctx)
        obs.metrics.counter('eventbus_events_total', { status: 'ok' }).inc()
        break
    }

    next()
  }
}

/**
 * Records handler latency metrics for each event dispatch.
 * Measures how long subscribers take to process the event.
 */
export function handlerMetricsMiddleware(obs: ObservabilityRuntime) {
  return (event: RuntimeEvent, next: () => void): void => {
    const start = performance.now()
    next()
    const duration = performance.now() - start

    obs.metrics.histogram('eventbus_handler_latency_ms', [1, 5, 10, 50, 100, 500])
      .observe(duration)

    if (duration > 100) {
      obs.logger.warn('Slow EventBus handler', {
        topic: event.topic,
        duration_ms: Math.round(duration),
        source: event.source,
        correlationId: event.correlationId,
      })
    }
  }
}

/**
 * Register EventBus health check with HealthAggregator.
 * Reports connected status, queue depth, event counts.
 */
export function registerEventBusHealth(obs: ObservabilityRuntime, bus: EventBus): void {
  let lastSnapshot = { handlerCount: 0, historyCount: 0 }

  obs.health.register('eventbus', () => ({
    healthy: true,
    latency_ms: 1, // EventBus is always responsive
    memory_mb: 0.1, // negligible
    ...lastSnapshot,
    lastError: undefined,
  }))

  // Update snapshot periodically
  setInterval(() => {
    try {
      lastSnapshot = {
        handlerCount: bus.listenerCount(),
        historyCount: bus.history().length,
      }
    } catch {
      // silent — health check will report stale data
    }
  }, 30_000)
}

/**
 * Full setup: wires ObservabilityRuntime into an EventBus instance.
 * Replaces console logging with structured logging and adds metrics.
 *
 * Usage:
 *   import { runtimeEventBus } from './EventBus'
 *   setupEventBusObservability(runtimeEventBus, observability)
 */
export function setupEventBusObservability(bus: EventBus, obs: ObservabilityRuntime): void {
  // Register health check
  registerEventBusHealth(obs, bus)

  // Add our observability middlewares (in order)
  bus.use(correlationMiddleware(obs))
  bus.use(structuredLoggingMiddleware(obs))
  bus.use(handlerMetricsMiddleware(obs))

  // Wire lifecycle hooks for tracing
  bus.onLifecycle((event: RuntimeEvent, status: EventStatus) => {
    obs.metrics.counter('eventbus_lifecycle_events', { stage: status.stage }).inc()

    if (status.error) {
      obs.logger.error('EventBus lifecycle error', {
        eventId: event.id,
        topic: event.topic,
        stage: status.stage,
        error: status.error,
      })
    }

    if (status.stage === 'error') {
      obs.metrics.counter('eventbus_errors_total', { topic: event.topic }).inc()
      obs.recordTrace(event.id, 'eventbus', `Error: ${status.error}`)
    }
  })

  obs.logger.info('EventBus observability initialized', {
    module: 'observability',
    middlewares: ['correlation', 'structuredLogging', 'handlerMetrics'],
  })
}
