/**
 * SubscriptionManager.ts — Manages symbol subscriptions across adapters
 *
 * Tracks which symbols are subscribed, deduplicates requests,
 * and coordinates subscription lifecycle across multiple feed adapters.
 *
 * @since 4.2
 */

import type { FeedAdapter } from '../adapters/FeedAdapter'

export type SubscriptionState = 'active' | 'pending' | 'failed'

interface Subscription {
  symbol: string
  state: SubscriptionState
  subscribedAt: number
  error?: string
}

export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription>()
  private adapters: FeedAdapter[] = []

  /** Register an adapter */
  registerAdapter(adapter: FeedAdapter): void {
    this.adapters.push(adapter)
  }

  /** Remove an adapter */
  unregisterAdapter(adapterId: string): void {
    this.adapters = this.adapters.filter(a => a.id !== adapterId)
  }

  /** Subscribe to a symbol across all registered adapters */
  async subscribe(symbol: string): Promise<void> {
    const normalized = symbol.toUpperCase()

    if (this.subscriptions.has(normalized)) {
      const existing = this.subscriptions.get(normalized)!
      if (existing.state === 'active') return
    }

    this.subscriptions.set(normalized, {
      symbol: normalized,
      state: 'pending',
      subscribedAt: Date.now(),
    })

    try {
      await Promise.all(this.adapters.map(a => a.subscribe(normalized)))
      this.subscriptions.set(normalized, {
        symbol: normalized,
        state: 'active',
        subscribedAt: Date.now(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.subscriptions.set(normalized, {
        symbol: normalized,
        state: 'failed',
        subscribedAt: Date.now(),
        error: message,
      })
      throw err
    }
  }

  /** Unsubscribe from a symbol */
  async unsubscribe(symbol: string): Promise<void> {
    const normalized = symbol.toUpperCase()
    await Promise.all(this.adapters.map(a => a.unsubscribe(normalized)))
    this.subscriptions.delete(normalized)
  }

  /** Unsubscribe from all symbols */
  async unsubscribeAll(): Promise<void> {
    const symbols = Array.from(this.subscriptions.keys())
    await Promise.all(symbols.map(s => this.unsubscribe(s)))
  }

  /** Get subscription state */
  getState(symbol: string): SubscriptionState | undefined {
    return this.subscriptions.get(symbol.toUpperCase())?.state
  }

  /** List active subscriptions */
  getActiveSymbols(): string[] {
    return Array.from(this.subscriptions.entries())
      .filter(([_, sub]) => sub.state === 'active')
      .map(([symbol]) => symbol)
  }

  /** Get all subscriptions with states */
  getAll(): Subscription[] {
    return Array.from(this.subscriptions.values())
  }

  /** Get count of active subscriptions */
  get activeCount(): number {
    return this.getActiveSymbols().length
  }
}
