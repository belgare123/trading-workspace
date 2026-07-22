/**
 * CorrelationContext — trace ID generation and propagation.
 *
 * Every trade/order gets a unique trace ID that flows through the entire
 * pipeline (Strategy → Risk → Wallet → Gateway → Exchange → Fill).
 * Any log, metric, or span is correlated by this ID.
 *
 * Usage:
 *   const trace = CorrelationContext.start('trade')
 *   logger.info({ traceId: trace.id, message: 'Order submitted' })
 *   trace.complete('filled')
 *
 * @since 6.1.0
 */

import { randomUUID } from 'node:crypto'

/* ── Types ── */

export interface TraceSpan {
  /** Unique trace ID (e.g. "trade_20260722_a1b2c3d4") */
  readonly id: string
  /** Trace type (trade, order, signal, feed, system) */
  readonly type: string
  /** ISO-8601 start timestamp */
  readonly startedAt: string
  /** Optional parent trace ID (nested spans) */
  readonly parentId?: string
  /** Human-readable label */
  label: string
  /** Arbitrary context attached to trace */
  tags: Record<string, string>
  /** End timestamp (set by complete()) */
  completedAt?: string
  /** Final status (set by complete()) */
  status?: 'ok' | 'error' | 'timeout'
}

export interface TraceContext {
  /** Current trace span */
  readonly span: TraceSpan
  /** Create a child trace (nested span) */
  child(type: string, label?: string): TraceSpan
  /** Complete this trace span */
  complete(status?: TraceSpan['status']): void
  /** Add a log entry to this trace */
  log(level: string, message: string, context?: Record<string, unknown>): void
  /** Emit a timeline event at this trace */
  milestone(name: string, detail?: string): void
}

/* ── Generator ── */

let _counter = 0

function nextId(type: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const short = randomUUID().slice(0, 8)
  const seq = (_counter++ % 9999).toString().padStart(4, '0')
  return `${type}_${date}_${short}${seq}`
}

/* ── Logger reference (set by ObservabilityRuntime.init) ── */

let _loggerRef: { info(m: Record<string, unknown>): void } | null = null

export function _setLoggerRef(l: typeof _loggerRef): void {
  _loggerRef = l
}

/* ── Timeline store (shared with EventTracer) ── */

export interface Milestone {
  traceId: string
  timestamp: string
  name: string
  detail?: string
}

const _milestones: Milestone[] = []
const MAX_MILESTONES = 10_000

export function _getMilestones(): readonly Milestone[] {
  return _milestones
}

export function _clearMilestones(): void {
  _milestones.length = 0
}

export function _clearActiveSpans(): void {
  _activeSpans.clear()
}

/* ── Span storage (active traces) ── */

const _activeSpans = new Map<string, TraceSpan>()

/* ── Core API ── */

export const CorrelationContext = {
  /** Start a new trace. Returns a TraceContext for chaining operations. */
  start(type: string, label?: string, parentId?: string): TraceContext {
    const span: TraceSpan = {
      id: nextId(type),
      type,
      startedAt: new Date().toISOString(),
      parentId,
      label: label ?? type,
      tags: {},
    }
    _activeSpans.set(span.id, span)

    const ctx: TraceContext = {
      span,

      child(childType: string, childLabel?: string): TraceSpan {
        const child = CorrelationContext.start(childType, childLabel, span.id)
        return child.span
      },

      complete(status?: TraceSpan['status']): void {
        span.completedAt = new Date().toISOString()
        span.status = status
        if (status === 'error') {
          _loggerRef?.info({ traceId: span.id, level: 'error', message: `Trace completed with error: ${span.label}`, duration_ms: getDuration(span) })
        }
      },

      log(level: string, message: string, context?: Record<string, unknown>): void {
        _loggerRef?.info({
          traceId: span.id,
          level,
          message,
          label: span.label,
          ...(context ?? {}),
        })
      },

      milestone(name: string, detail?: string): void {
        const entry: Milestone = {
          traceId: span.id,
          timestamp: new Date().toISOString(),
          name,
          detail,
        }
        _milestones.push(entry)
        if (_milestones.length > MAX_MILESTONES) {
          _milestones.splice(0, _milestones.length - MAX_MILESTONES)
        }
      },
    }

    _loggerRef?.info({
      traceId: span.id,
      level: 'info',
      module: 'correlation',
      message: `Trace started: ${type} — ${label ?? ''}`,
      parentId: parentId ?? undefined,
    })

    return ctx
  },

  /** Get a span by ID (for attaching to logs/metrics) */
  getSpan(id: string): TraceSpan | undefined {
    return _activeSpans.get(id)
  },

  /** List all active (non-completed) traces */
  getActiveSpans(): TraceSpan[] {
    return Array.from(_activeSpans.values()).filter(s => !s.completedAt)
  },

  /** Active trace count */
  get activeCount(): number {
    return this.getActiveSpans().length
  },
}

/* ── Helpers ── */

function getDuration(span: TraceSpan): number | undefined {
  if (!span.completedAt) return undefined
  return new Date(span.completedAt).getTime() - new Date(span.startedAt).getTime()
}
