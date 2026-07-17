/**
 * ScenarioDefinition.ts — Core types for platform certification scenarios
 *
 * Every scenario is an atomic, self-contained check of one platform capability.
 * Scenarios are run by ScenarioRunner and aggregated by CertificationRuntime.
 *
 * @since 4.9
 */

import type { BrokerAdapter } from '../live/live/BrokerAdapter'
import type { GatewayRuntime } from '../live/gateway/GatewayRuntime'

// ═══════════════════════════════════════════════
// Scenario Identity
// ═══════════════════════════════════════════════

/** Unique scenario identifier */
export type ScenarioId = string & { readonly __brand: 'ScenarioId' }

export function scenarioId(id: string): ScenarioId {
  return id as ScenarioId
}

// ═══════════════════════════════════════════════
// Scenario Category
// ═══════════════════════════════════════════════

export type ScenarioCategory =
  | 'connectivity'
  | 'orders'
  | 'risk'
  | 'recovery'
  | 'infrastructure'
  | 'history'
  | 'metrics'

export const ALL_CATEGORIES: readonly ScenarioCategory[] = [
  'connectivity',
  'orders',
  'risk',
  'recovery',
  'infrastructure',
  'history',
  'metrics',
] as const

// ═══════════════════════════════════════════════
// Scenario Severity
// ═══════════════════════════════════════════════

export type ScenarioSeverity = 'critical' | 'high' | 'medium' | 'low'

// ═══════════════════════════════════════════════
// Scenario Outcome
// ═══════════════════════════════════════════════

export type ScenarioVerdict = 'passed' | 'failed' | 'skipped' | 'error'

export interface ScenarioOutcome {
  verdict: ScenarioVerdict
  /** Human-readable explanation */
  message: string
  /** Error details if verdict is 'failed' or 'error' */
  error?: string
  /** Elapsed wall-clock time in ms */
  durationMs: number
  /** Structured details for report enrichment */
  details?: Record<string, unknown>
}

// ═══════════════════════════════════════════════
// Scenario Context
// ═══════════════════════════════════════════════

/**
 * Context passed to every scenario execution.
 * Provides access to the platform runtime components under test.
 */
export interface ScenarioContext {
  /** Broker adapter (from LiveProvider) */
  broker: BrokerAdapter
  /** Gateway runtime (order router, risk, recovery) */
  gateway?: GatewayRuntime
  /** Global signal — scenario should abort if aborted */
  signal?: AbortSignal

  // ── Convenience helpers injected by CertificationRuntime ──

  /** Logger scoped to this scenario */
  log: (msg: string) => void
  /** Assert a condition; fails the scenario if false */
  assert: (condition: boolean, message: string) => asserts condition
  /** Assert deep equality */
  assertEqual: <T>(actual: T, expected: T, message?: string) => void
  /** Assert truthy with optional message */
  assertOk: (value: unknown, message?: string) => asserts value
  /** Wait for a predicate to be true (polling) */
  waitFor: (predicate: () => boolean | Promise<boolean>, timeoutMs?: number, intervalMs?: number) => Promise<void>
  /** Sleep without yielding (avoids tight loops) */
  sleep: (ms: number) => Promise<void>
}

// ═══════════════════════════════════════════════
// Scenario Definition
// ═══════════════════════════════════════════════

export type ScenarioExecute = (ctx: ScenarioContext) => Promise<ScenarioOutcome>

export interface ScenarioDefinition {
  /** Unique identifier (e.g. 'connectivity-01') */
  id: ScenarioId
  /** Human-readable name */
  name: string
  /** Detailed description */
  description: string
  /** Category */
  category: ScenarioCategory
  /** Severity */
  severity: ScenarioSeverity
  /** Execution timeout in ms (default: 10_000) */
  timeoutMs?: number
  /** Whether this scenario requires a connected broker */
  requiresConnection?: boolean
  /** Whether this scenario requires a gateway runtime */
  requiresGateway?: boolean
  /** Tags for filtering */
  tags?: string[]
  /** The scenario logic */
  execute: ScenarioExecute
}

// ═══════════════════════════════════════════════
// Scenario Result (after execution)
// ═══════════════════════════════════════════════

export interface ScenarioResult {
  definition: ScenarioDefinition
  outcome: ScenarioOutcome
  /** ISO timestamp when execution started */
  startedAt: string
  /** Whether the scenario was skipped due to missing dependencies */
  skipped: boolean
  /** Skip reason */
  skipReason?: string
}

// ═══════════════════════════════════════════════
// Scenario Filter
// ═══════════════════════════════════════════════

export interface ScenarioFilter {
  categories?: ScenarioCategory[]
  severity?: ScenarioSeverity[]
  tags?: string[]
  ids?: ScenarioId[]
}

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

export const scenarioPassed = (message: string, details?: Record<string, unknown>): ScenarioOutcome => ({
  verdict: 'passed',
  message,
  durationMs: 0,
  details,
})

export const scenarioFailed = (message: string, error?: string): ScenarioOutcome => ({
  verdict: 'failed',
  message,
  error,
  durationMs: 0,
})

export const scenarioSkipped = (reason: string): ScenarioOutcome => ({
  verdict: 'skipped',
  message: reason,
  durationMs: 0,
})
