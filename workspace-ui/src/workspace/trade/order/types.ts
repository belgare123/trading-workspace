// ── OrderManager: types ──

import type { OrderType } from '../types'

/** Local tracking state for an order in OrderTracker */
export const OrderTrackerState = {
  /** Order created locally, not yet sent to exchange */
  Active: 'Active',
  /** Order sent to exchange, accepted, actively working */
  Working: 'Working',
  /** Cancel request in flight, waiting for exchange confirmation */
  PendingCancel: 'PendingCancel',
  /** Cancel+Replace in flight */
  Replacing: 'Replacing',
  /** Terminal — filled, cancelled, expired */
  Completed: 'Completed',
  /** Terminal — rejected or dead-letter after retry exhaustion */
  Failed: 'Failed',
} as const

export type OrderTrackerState = (typeof OrderTrackerState)[keyof typeof OrderTrackerState]

/** FSM transition table for OrderTracker */
export const ORDER_TRACKER_TRANSITIONS: Record<OrderTrackerState, OrderTrackerState[]> = {
  [OrderTrackerState.Active]:        [OrderTrackerState.Working, OrderTrackerState.Failed],
  [OrderTrackerState.Working]:       [OrderTrackerState.PendingCancel, OrderTrackerState.Replacing, OrderTrackerState.Completed, OrderTrackerState.Failed],
  [OrderTrackerState.PendingCancel]: [OrderTrackerState.Completed, OrderTrackerState.Failed],
  [OrderTrackerState.Replacing]:     [OrderTrackerState.Working, OrderTrackerState.Failed],
  [OrderTrackerState.Completed]:     [],
  [OrderTrackerState.Failed]:        [],
}

/** Timeout SLA configuration per order type */
export interface TimeoutConfig {
  /** Timeout in ms before action is taken */
  timeoutMs: number
  /** Action to take on timeout: 'cancel' | 'replace' | 'alert' | 'none' */
  action: 'cancel' | 'replace' | 'alert' | 'none'
}

/** Default SLA for each order type */
export const DEFAULT_TIMEOUT_SLA: Partial<Record<string, TimeoutConfig>> = {
  market:     { timeoutMs: 10_000, action: 'alert' },
  limit:      { timeoutMs: 30_000, action: 'replace' },
  stop:       { timeoutMs: 60_000, action: 'cancel' },
  stop_limit: { timeoutMs: 60_000, action: 'cancel' },
}

/** Retry state for a single call attempt */
export interface RetryAttempt {
  attempt: number
  delayMs: number | null
  error: unknown
  timestamp: number
}

export interface RetryState {
  /** Max retries configured for this call */
  maxAttempts: number
  /** All attempts made so far */
  attempts: RetryAttempt[]
  /** Whether this has been sent to dead letter */
  dead: boolean
}
