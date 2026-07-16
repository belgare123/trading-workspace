/**
 * StrategyHistoryStore.ts — Tracks strategy-level events and metrics
 *
 * Records all strategy-related events: signal generation,
 * condition evaluations, action execution, and strategy state changes.
 * Complements DecisionLog by providing a strategy-centric view.
 *
 * @since 4.4
 */

export interface StrategyEvent {
  id: string
  strategyId: string
  type: 'started' | 'stopped' | 'configured' | 'signal' | 'action' | 'error' | 'warning'
  timestamp: number
  message: string
  symbol?: string
  data?: Record<string, unknown>
}

export class StrategyHistoryStore {
  private events: StrategyEvent[] = []
  private maxEntries: number

  constructor(maxEntries = 2_000) {
    this.maxEntries = maxEntries
  }

  // ── Events ──

  recordEvent(event: Omit<StrategyEvent, 'id'>): StrategyEvent {
    const full: StrategyEvent = {
      ...event,
      id: `se_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    }
    this.events.push(full)
    this.trimArray(this.events)
    return full
  }

  recordStarted(strategyId: string, message?: string): StrategyEvent {
    return this.recordEvent({ strategyId, type: 'started', timestamp: Date.now(), message: message ?? 'Strategy started' })
  }

  recordStopped(strategyId: string, message?: string): StrategyEvent {
    return this.recordEvent({ strategyId, type: 'stopped', timestamp: Date.now(), message: message ?? 'Strategy stopped' })
  }

  recordError(strategyId: string, error: string): StrategyEvent {
    return this.recordEvent({ strategyId, type: 'error', timestamp: Date.now(), message: error })
  }

  // ── Queries ──

  getEvents(strategyId?: string): StrategyEvent[] {
    if (strategyId) return this.events.filter(e => e.strategyId === strategyId)
    return [...this.events]
  }

  getErrors(strategyId?: string): StrategyEvent[] {
    return this.events.filter(e => e.type === 'error' && (!strategyId || e.strategyId === strategyId))
  }

  getRecent(n = 50): StrategyEvent[] {
    return this.events.slice(-n).reverse()
  }

  get size(): number {
    return this.events.length
  }

  clear(): void {
    this.events = []
  }

  private trimArray<T>(arr: T[]): void {
    if (arr.length > this.maxEntries) {
      arr.splice(0, arr.length - this.maxEntries)
    }
  }
}
