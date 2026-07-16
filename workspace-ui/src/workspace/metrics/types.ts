// ── Metrics Types — shared contracts for Analytics Runtime ──
//
// All types used across metric definitions, collectors, curves, reports.
// No direct dependency on execution/ internals — only event types.
//
// @since 3.5.2

import type { TradeRecord, EquitySnapshot, Position } from '../execution/types'
import type { ExecutionEvent, ExecutionEventBus } from '../execution/events/ExecutionEvents'

// ═══════════════════════════════════════
// Metric Categories
// ═══════════════════════════════════════

export type MetricCategory = 'trade' | 'risk' | 'performance'

// ═══════════════════════════════════════
// Metric Definition & Value
// ═══════════════════════════════════════

export interface MetricDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: MetricCategory
  compute(ctx: MetricContext): MetricValue
}

export interface MetricValue {
  id: string
  name: string
  value: number
  formatted: string
  category: MetricCategory
  metadata?: Record<string, unknown>
}

export interface MetricContext {
  trades: TradeRecord[]
  equity: EquitySnapshot[]
  positions: Position[]
  balancePoints: TimePoint[]
  equityPoints: TimePoint[]
  positionEvents: PositionEventData[]
}

export interface TimePoint {
  timestamp: number
  value: number
}

export interface PositionEventData {
  timestamp: number
  symbol: string
  direction: 'long' | 'short' | 'flat'
  quantity: number
  entryPrice: number
  type: 'OPENED' | 'UPDATED' | 'CLOSED'
}

// ═══════════════════════════════════════
// Collector Interfaces
// ═══════════════════════════════════════

export interface Collector {
  readonly id: string
  /** Subscribe to event bus and start collecting */
  connect(eventBus: EventBusHandle): void
  /** Reset all collected data */
  reset(): void
}

/** Shape of the event bus methods collectors need */
export type EventBusHandle = Pick<ExecutionEventBus, 'on' | 'subscribe'>

// ═══════════════════════════════════════
// Curve Types
// ═══════════════════════════════════════

export interface CurvePoint {
  timestamp: number
  value: number
  label?: string
}

export interface Curve {
  readonly id: string
  readonly name: string
  readonly points: CurvePoint[]
}

export interface DrawdownPoint extends CurvePoint {
  peak: number
  drawdownPct: number
}

// ═══════════════════════════════════════
// Report Types
// ═══════════════════════════════════════

export interface MetricsReport {
  id: string
  name: string
  timestamp: number
  metrics: MetricValue[]
  curves: Curve[]
  metadata?: Record<string, unknown>
}

// ── Re-export execution types used in public API ──
export type { TradeRecord, EquitySnapshot, Position, ExecutionEvent }
