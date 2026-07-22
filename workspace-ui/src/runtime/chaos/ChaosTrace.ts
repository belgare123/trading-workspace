/**
 * ChaosTrace.ts — Domain models for Chaos Trace subsystem
 *
 * Sprint 6.6.2a — a structured incident record that links every
 * injection decision to the wider observability stack.
 *
 * A ChaosTrace represents a single "incident" — one rule being
 * triggered, its effect applied, and the system's response.
 * It carries correlation identifiers (traceId, strategyId, orderId)
 * so it can be joined with the Structured Logger, Runtime Telemetry,
 * Event Journal, ReplayEngine, and future Chaos Reports.
 *
 * Each trace has an ordered timeline of ChaosTraceEvent entries
 * that capture phase transitions (matched → started → effect →
 * finished / recovered).
 *
 * @since 6.6.2a
 */

import type { FailureInjectionScope } from './InjectionRule'

// ── Status ──

export type ChaosTraceStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

// ── Phase ──

export type ChaosTracePhase =
  | 'matched'
  | 'started'
  | 'effect'
  | 'finished'
  | 'recovered'

// ── Severity ──

/**
 * Computed incident severity derived from injection type, duration,
 * scope, and system response (circuit breaker, safe mode).
 *
 * Added in Sprint 6.6 — Correlation & Timeline enhancements.
 */
export type ChaosTraceSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical'

/**
 * Compute severity from trace properties.
 *
 * Rules:
 * - critical: connection_refused, disconnect, whole-system GLOBAL timeout
 * - error: timeout, packet_loss, rate_limit on ORDERS/Wallet, any action
 *   lasting >30s
 * - warning: latency >5s, partial_response, rate_limit on MARKET_DATA
 * - info: latency <5s, malformed_response, partial_response on MARKET_DATA
 */
export function computeSeverity(trace: {
  actionType: string
  scope: FailureInjectionScope
  durationMs?: number
  breakerOpened?: boolean
  safeMode?: boolean
}): ChaosTraceSeverity {
  if (trace.safeMode || trace.breakerOpened) return 'critical'

  switch (trace.actionType) {
    case 'connection_refused':
    case 'disconnect':
      return 'critical'
    case 'timeout':
      if (trace.scope === 'global') return 'critical'
      return 'error'
    case 'packet_loss':
      return 'error'
    case 'rate_limit':
      if (trace.scope === 'orders' || trace.scope === 'positions') return 'error'
      return 'warning'
    case 'latency':
      if ((trace.durationMs ?? 0) > 5_000) return 'warning'
      return 'info'
    case 'partial_response':
      if (trace.scope === 'orders' || trace.scope === 'positions') return 'error'
      return 'warning'
    case 'malformed_response':
      return 'info'
    default:
      return 'warning'
  }
}

// ── Core models ──

/**
 * A single chaos incident.
 *
 * Created when evaluate() returns a non-none action and the
 * transport wrapper begins applying the injection.
 */
export interface ChaosTrace {
  readonly id: string

  /** Cross-system correlation identifiers */
  readonly traceId?: string
  readonly correlationTraceId?: string
  readonly strategyId?: string
  readonly orderId?: string
  readonly symbol?: string

  /** The rule that triggered this incident */
  readonly ruleId: string
  readonly scope: FailureInjectionScope
  readonly actionType: string

  /** Lifecycle */
  readonly startedAt: number
  finishedAt?: number
  status: ChaosTraceStatus
  error?: string

  /** Computed severity (set by ChaosTraceRuntime on completion) */
  severity?: ChaosTraceSeverity

  /** Event Sourcing replay anchors for incident reproduction */
  replayCursor?: string
  snapshotSequence?: number
}

/**
 * A single phase event within a ChaosTrace timeline.
 */
export interface ChaosTraceEvent {
  /** Links to ChaosTrace.id */
  readonly traceId: string

  readonly timestamp: number
  readonly phase: ChaosTracePhase
  readonly message: string

  /** Arbitrary structured payload (e.g. action params, error details) */
  readonly data?: unknown
}

// ── Trace factory ──

let _nextId = 0

export function nextChaosTraceId(): string {
  return `chaos-${Date.now()}-${++_nextId}`
}

// ════════════════════════════════════════════
// Event journal — compact container
// ════════════════════════════════════════════

/**
 * In-memory event journal for a single ChaosTrace.
 * Designed to be serialisable for ReplayEngine integration.
 */
export class TraceEventJournal {
  readonly traceId: string
  readonly events: ChaosTraceEvent[] = []

  constructor(traceId: string) {
    this.traceId = traceId
  }

  append(phase: ChaosTracePhase, message: string, data?: unknown): void {
    this.events.push({
      traceId: this.traceId,
      timestamp: Date.now(),
      phase,
      message,
      data,
    })
  }

  get timeline(): readonly ChaosTraceEvent[] {
    return this.events
  }

  /** Serialisable snapshot for EventJournal / ReplayEngine */
  toJSON(): { traceId: string; events: ChaosTraceEvent[] } {
    return {
      traceId: this.traceId,
      events: [...this.events],
    }
  }
}
