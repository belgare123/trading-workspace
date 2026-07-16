/**
 * AccountSynchronizer.ts — Balance/account synchronization
 *
 * Periodically polls broker for balances and equity via AccountAdapter.
 * Publishes EQUITY_CHANGED events to keep PnL tracking current.
 *
 * Two sources of truth:
 *   1. Push — subscribeBalances() for real-time updates
 *   2. Pull — periodic REST polling for reconciliation
 *
 * @since 4.5
 */

import type { BrokerAdapter, AccountAdapter } from './BrokerAdapter'
import type { BrokerAccountInfo } from './types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { EquitySnapshot } from '../../execution/types'

export class AccountSynchronizer {
  private adapter: AccountAdapter
  private eventBus?: ExecutionEventBus
  private timer: ReturnType<typeof setInterval> | null = null
  private lastEquity = 0
  private unsubscribers: Array<() => void> = []

  constructor(adapter: BrokerAdapter) {
    this.adapter = adapter.account
  }

  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus

    // Subscribe to real-time balance updates
    this.unsubscribers.push(
    this.adapter.subscribeBalances(() => {
      // Balance-only update — doesn't include full equity
      // Will be reconciled on next REST poll
    })
    )
  }

  /** Start periodic sync */
  start(intervalMs = 10_000): void {
    if (this.timer) return
    this.timer = setInterval(() => this.sync(), intervalMs)
  }

  /** Stop sync */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** One-shot sync via REST */
  async sync(): Promise<void> {
    try {
      const info = await this.adapter.getAccountInfo()
      this.emitEquityChanged(info)
    } catch (err) {
      console.error('[AccountSynchronizer] REST sync failed:', err)
    }
  }

  private emitEquityChanged(info: BrokerAccountInfo): void {
    if (!this.eventBus) return

    const prev: EquitySnapshot = {
      cash: this.lastEquity,
      positionsValue: 0,
      totalEquity: this.lastEquity,
      unrealizedPnl: info.unrealizedPnl,
      timestamp: Date.now(),
    }

    this.lastEquity = info.totalEquity

    const snapshot: EquitySnapshot = {
      cash: info.totalEquity - info.unrealizedPnl,
      positionsValue: info.unrealizedPnl,
      totalEquity: info.totalEquity,
      unrealizedPnl: info.unrealizedPnl,
      timestamp: Date.now(),
    }

    this.eventBus.emit({
      type: 'EQUITY_CHANGED',
      equity: snapshot,
      previousEquity: prev,
      timestamp: Date.now(),
    })
  }

  dispose(): void {
    this.stop()
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
  }
}
