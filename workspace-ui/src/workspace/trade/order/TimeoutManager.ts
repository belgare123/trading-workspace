// ── TimeoutManager — SLA-based order timeouts ──

import { OrderId } from '../Order'
import { OrderType } from '../types'
import { DEFAULT_TIMEOUT_SLA, type TimeoutConfig } from './types'

export interface TimeoutAction {
  orderId: string
  action: 'cancel' | 'replace' | 'alert' | 'none'
  elapsedMs: number
  slaMs: number
}

export class TimeoutManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private callbacks: Map<string, (action: TimeoutAction) => void>
  private sla: Partial<Record<string, TimeoutConfig>>

  constructor(
    callbacks?: Map<string, (action: TimeoutAction) => void>,
    customSla?: Partial<Record<string, TimeoutConfig>>,
  ) {
    this.callbacks = callbacks ?? new Map()
    this.sla = { ...DEFAULT_TIMEOUT_SLA, ...customSla }
  }

  /** Start a timeout for an order */
  startOrder(orderId: string, orderType: string, onTimeout: (action: TimeoutAction) => void): void {
    this.cancelTimer(orderId) // cancel any existing timer

    const config = this.sla[orderType] ?? this.sla.limit!
    const timer = setTimeout(() => {
      const action: TimeoutAction = {
        orderId,
        action: config.action,
        elapsedMs: config.timeoutMs,
        slaMs: config.timeoutMs,
      }
      onTimeout(action)
      // Execute registered callback if any
      this.callbacks.get(orderId)?.(action)
    }, config.timeoutMs)

    this.timers.set(orderId, timer)
  }

  /** Reset timeout for an order (e.g. after partial fill) */
  refreshOrder(orderId: string): void {
    // Refreshes are not supported in the basic version —
    // the order already has a timer, we could cancel+restart
    // but that would mean the SLA resets on every fill.
    // Keeping as no-op for now, but the extension point is here.
  }

  /** Cancel a timer */
  cancelOrder(orderId: string): void {
    this.cancelTimer(orderId)
    this.callbacks.delete(orderId)
  }

  /** Register a persistent callback for timeout actions */
  onTimeout(orderId: string, handler: (action: TimeoutAction) => void): void {
    this.callbacks.set(orderId, handler)
  }

  /** Get remaining time for an order (ms left) */
  getRemaining(orderId: string): number | undefined {
    // Not tracked — use external timer tracking if needed
    return undefined
  }

  /** Cancel all timers */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.callbacks.clear()
  }

  private cancelTimer(orderId: string): void {
    const timer = this.timers.get(orderId)
    if (timer !== undefined) {
      clearTimeout(timer)
      this.timers.delete(orderId)
    }
  }
}
