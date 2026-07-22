// ── StrategyRegistry — enhanced registry with lifecycle ──
// Sprint 5.7 — StrategyRuntime Integration

import { StrategyRegistry as BaseRegistry } from '../strategy/registry/StrategyRegistry'
import type { StrategyDefinition, StrategyBar } from '../strategy/definition'
import type { StrategySignal } from '../strategy/types'
import type { StrategyScheduler } from './StrategyScheduler'
import type { StrategyExecutor } from './StrategyExecutor'
import type { StrategyContext } from './types'

export interface ManagedStrategy {
  id: string
  definitionId: string
  name: string
  symbol: string
  timeframe: string
  enabled: boolean
  config: Record<string, unknown>
}

/**
 * StrategyRegistry — manages strategy definitions and running instances.
 * Extends the base registry with enable/disable lifecycle.
 */
export class StrategyRegistry {
  private readonly _base = BaseRegistry
  private readonly _instances = new Map<string, ManagedStrategy>()
  private readonly _scheduler: StrategyScheduler
  private readonly _executor: StrategyExecutor

  constructor(scheduler: StrategyScheduler, executor: StrategyExecutor) {
    this._scheduler = scheduler
    this._executor = executor
  }

  /** Register a strategy definition (delegates to base registry) */
  register(def: StrategyDefinition): void {
    this._base.register(def)
  }

  /** Get a definition by id */
  getDefinition(id: string): StrategyDefinition | undefined {
    return this._base.get(id)
  }

  /** List all registered definitions */
  listDefinitions(): readonly StrategyDefinition[] {
    return this._base.list()
  }

  /** Enable a strategy for live execution */
  enable(definitionId: string, config: {
    symbol: string
    timeframe: string
    name?: string
    params?: Record<string, unknown>
  }): string {
    const def = this._base.get(definitionId)
    if (!def) throw new Error(`Strategy definition not found: ${definitionId}`)

    const id = `${definitionId}_${config.symbol}_${Date.now()}`
    const instance: ManagedStrategy = {
      id,
      definitionId,
      name: config.name ?? def.name,
      symbol: config.symbol,
      timeframe: config.timeframe,
      enabled: true,
      config: config.params ?? {},
    }

    this._instances.set(id, instance)
    this._scheduler.subscribe(config.symbol, config.timeframe, (ctx: StrategyContext) => {
      if (!instance.enabled) return
      const bar: StrategyBar = {
        open: ctx.tick.price,
        high: ctx.tick.price,
        low: ctx.tick.price,
        close: ctx.tick.price,
        volume: 0,
        timestamp: ctx.tick.timestamp,
      }
      const signal = def.onBar(
        { bar, bars: [], timestamp: bar.timestamp },
        // Mock execution context — strategy gets data from StrategyContext
        { state: instance.config } as any,
      )
      if (signal) {
        this._executor.execute(definitionId, signal, ctx.tick.price)
      }
    })

    return id
  }

  /** Disable a running strategy instance */
  disable(id: string): void {
    const inst = this._instances.get(id)
    if (inst) {
      inst.enabled = false
      this._scheduler.unsubscribe(inst.symbol, inst.timeframe)
    }
  }

  /** List all managed instances */
  list(): readonly ManagedStrategy[] {
    return [...this._instances.values()]
  }

  /** Get a managed instance */
  get(id: string): ManagedStrategy | undefined {
    return this._instances.get(id)
  }
}
