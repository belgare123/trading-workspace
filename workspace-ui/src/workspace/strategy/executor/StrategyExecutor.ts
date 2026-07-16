// ── StrategyExecutor — bar feed and execution engine ──
// Receives market data bars and drives StrategyRuntime ticks.
// Manages the bar history buffer and handles subscriptions.
//
// @since 3.4.1

import type { StrategyBar } from '../definition/StrategyDefinition'
import { StrategyRuntime } from '../runtime/StrategyRuntime'

export interface BarFeed {
  /** Subscribe to bars for a symbol/timeframe. Returns unsubscribe function. */
  subscribe(symbol: string, timeframe: string, cb: (bar: StrategyBar) => void): () => void
}

export class StrategyExecutor {
  private readonly _runtime: StrategyRuntime
  private readonly _feed: BarFeed
  private readonly _barHistory = new Map<string, StrategyBar[]>()  // key: `${symbol}:${timeframe}`
  private readonly _subscriptions = new Map<string, () => void>()   // key: `${symbol}:${timeframe}`
  private readonly _instanceKeys = new Map<string, string>()        // instanceId → `${symbol}:${timeframe}`
  private readonly _maxHistory = 1000

  constructor(runtime: StrategyRuntime, feed: BarFeed) {
    this._runtime = runtime
    this._feed = feed
  }

  // ── Instance Management ──

  /** Add a strategy and subscribe to its feed. */
  add(
    definitionId: string,
    name: string,
    symbol: string,
    timeframe: string,
    params?: Record<string, unknown>,
  ): string {
    const instanceId = this._runtime.add(definitionId, name, symbol, timeframe, params)
    const key = `${symbol}:${timeframe}`

    this._instanceKeys.set(instanceId, key)

    // Subscribe to feed if not already subscribed
    if (!this._subscriptions.has(key)) {
      const unsub = this._feed.subscribe(symbol, timeframe, (bar) => {
        this._onBar(key, bar)
      })
      this._subscriptions.set(key, unsub)
    }

    return instanceId
  }

  /** Start a strategy instance. */
  start(id: string): void {
    this._runtime.start(id)
  }

  /** Pause a strategy instance. */
  pause(id: string): void {
    this._runtime.pause(id)
  }

  /** Stop and optionally remove a strategy instance. */
  stop(id: string, remove = false): void {
    this._runtime.stop(id)
    if (remove) {
      const key = this._instanceKeys.get(id)
      this._runtime.remove(id)
      this._instanceKeys.delete(id)

      // Check if we should unsubscribe
      if (key) {
        const hasOtherInstances = [...this._instanceKeys.values()].some((k) => k === key)
        if (!hasOtherInstances) {
          this._subscriptions.get(key)?.()
          this._subscriptions.delete(key)
          this._barHistory.delete(key)
        }
      }
    }
  }

  /** Stop all running instances. */
  stopAll(): void {
    for (const inst of this._runtime.getRunning()) {
      this._runtime.stop(inst.id)
    }
  }

  /** Clear all instances and subscriptions. */
  clear(): void {
    for (const unsub of this._subscriptions.values()) {
      unsub()
    }
    this._subscriptions.clear()
    this._barHistory.clear()
    this._instanceKeys.clear()
    this._runtime.clear()
  }

  // ── Bar History ──

  /** Get bar history for a symbol/timeframe. */
  getBarHistory(symbol: string, timeframe: string): readonly StrategyBar[] {
    return this._barHistory.get(`${symbol}:${timeframe}`) ?? []
  }

  // ── Private ──

  private _onBar(key: string, bar: StrategyBar): void {
    // Update history buffer
    let history = this._barHistory.get(key)
    if (!history) {
      history = []
      this._barHistory.set(key, history)
    }
    history.push(bar)
    if (history.length > this._maxHistory) {
      history.splice(0, history.length - this._maxHistory)
    }

    // Tick all running instances for this symbol/timeframe
    for (const inst of this._runtime.getAll()) {
      const instKey = this._instanceKeys.get(inst.id)
      if (instKey === key && inst.status === 'running') {
        this._runtime.tick(inst.id, bar)
      }
    }
  }
}
