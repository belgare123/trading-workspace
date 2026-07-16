/**
 * types.ts — History & Audit Runtime shared types
 *
 * @since 4.4
 */

import type { OrderSide, OrderType, OrderStatus } from '../../execution/types'

// ═══════════════════════════════════════
// Execution-level (Level 1)
// ═══════════════════════════════════════

export interface OrderHistoryEntry {
  orderId: string
  strategyId: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  status: OrderStatus
  /** Status transitions with timestamps */
  transitions: StatusTransition[]
  filledQuantity: number
  averagePrice: number
  commission: number
  createdAt: number
  updatedAt: number
  cancelledAt?: number
  filledAt?: number
}

export interface StatusTransition {
  from: OrderStatus
  to: OrderStatus
  timestamp: number
  reason?: string
  fillQuantity?: number
  fillPrice?: number
}

// ═══════════════════════════════════════
// Strategy-level (Level 2)
// ═══════════════════════════════════════

export interface SignalRecord {
  id: string
  strategyId: string
  name: string
  value: number
  timestamp: number
  symbol?: string
  /** Raw indicator data */
  data?: Record<string, unknown>
}

export interface ConditionRecord {
  id: string
  strategyId: string
  expression: string
  result: boolean
  timestamp: number
  /** Sub-expression evaluations */
  evaluations?: Array<{ expression: string; result: boolean }>
}

export interface ActionRecord {
  id: string
  strategyId: string
  action: string
  timestamp: number
  orderId?: string
  symbol?: string
  params?: Record<string, unknown>
}

// ═══════════════════════════════════════
// Decision-level (Level 3)
// ═══════════════════════════════════════

export interface DecisionRecord {
  id: string
  strategyId: string
  timestamp: number
  symbol?: string

  /** Signal that triggered evaluation */
  signal?: {
    name: string
    value: number
    score: number
  }
  /** Conditions that were evaluated */
  conditions: Array<{
    expression: string
    result: boolean
    weight: number
    score: number
  }>
  /** Action taken */
  action: {
    name: string
    confidence: number
    reason: string
  }

  /** Computed aggregate scores */
  aggregateScore: number
  confidenceScore: number

  /** Resulting order, if any */
  orderId?: string
  result?: 'executed' | 'skipped' | 'error'
  error?: string
}

// ═══════════════════════════════════════
// Position-level (Level 4)
// ═══════════════════════════════════════

export interface PositionHistoryEntry {
  positionId: string
  strategyId: string
  symbol: string
  direction: 'long' | 'short'

  openedAt: number
  openPrice: number
  initialQuantity: number

  events: PositionEvent[]

  closedAt?: number
  closePrice?: number
  realizedPnl?: number
  pnlPercent?: number
  maxDrawdown?: number
  maxRunup?: number
  duration?: number
}

export type PositionEventType =
  | 'opened'
  | 'scaled_in'
  | 'reduced'
  | 'stop_loss_moved'
  | 'take_profit_moved'
  | 'stop_loss_hit'
  | 'take_profit_hit'
  | 'closed'

export interface PositionEvent {
  type: PositionEventType
  timestamp: number
  price: number
  quantity?: number
  pnl?: number
  message?: string
}

// ═══════════════════════════════════════
// Session-level (Level 5)
// ═══════════════════════════════════════

export interface SessionRecord {
  sessionId: string
  strategyId: string
  startedAt: number
  endedAt?: number
  duration?: number

  ordersPlaced: number
  ordersFilled: number
  ordersCancelled: number

  totalVolume: number
  totalCommission: number
  netPnl: number
  winRate: number

  positionsOpened: number
  positionsClosed: number

  peakEquity: number
  currentEquity: number
  maxDrawdown: number

  decisions: number
  signalsProcessed: number
}

// ═══════════════════════════════════════
// Timeline (unified)
// ═══════════════════════════════════════

export type TimelineCategory =
  | 'market'
  | 'signal'
  | 'condition'
  | 'decision'
  | 'order'
  | 'fill'
  | 'position'
  | 'balance'
  | 'journal'
  | 'error'

export interface TimelineEntry {
  id: string
  timestamp: number
  category: TimelineCategory
  label: string
  detail: string
  /** Reference ID (orderId, positionId, signalId, etc.) */
  refId?: string
  symbol?: string
  strategyId?: string
  /** Arbitrary structured data */
  data?: Record<string, unknown>
}

// ═══════════════════════════════════════
// Historians
// ═══════════════════════════════════════

export interface HistoryConfig {
  /** Max entries per historian before trimming */
  maxEntries: number
  /** Snapshot interval (ms) */
  snapshotInterval?: number
  /** Auto-bind to ExecutionEventBus */
  autoBind?: boolean
}
