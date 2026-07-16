// ── StrategyRuntime — per-instance lifecycle manager ──
// Manages the lifecycle of running strategy instances:
//   add → register a new instance
//   start → begin execution
//   pause → suspend execution
//   stop → terminate execution
//
// Analogous to OverlayRuntime but with stateful lifecycle.
//
// @since 3.4.1

import { nanoid } from 'nanoid'
import type { StrategyBar } from '../definition'
import type { ExecutionContext } from '../context'
import type {
  StrategyInstanceData,
  StrategyStatus,
  StrategySignal,
} from '../types'
import { StrategyRegistry } from '../registry/StrategyRegistry'

export class StrategyRuntime {
  private readonly _instances = new Map<string, StrategyInstanceData>()
  private readonly _ctx: ExecutionContext

  constructor(ctx: ExecutionContext) {
    this._ctx = ctx
  }

  // ── Events ──

  private _listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  on(event: string, cb: (...args: unknown[]) => void): () => void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event)!.add(cb)
    return () => this._listeners.get(event)?.delete(cb)
  }

  private _emit(event: string, ...args: unknown[]): void {
    this._listeners.get(event)?.forEach((cb) => cb(...args))
  }

  // ── Lifecycle ──

  /**
   * Create and register a new strategy instance.
   * Returns the new instance id.
   */
  add(
    definitionId: string,
    name: string,
    symbol: string,
    timeframe: string,
    params?: Record<string, unknown>,
  ): string {
    const def = StrategyRegistry.get(definitionId)
    if (!def) throw new Error(`Strategy definition not found: ${definitionId}`)

    const id = `strat_${nanoid(12)}`
    const now = Date.now()

    const instance: StrategyInstanceData = {
      id,
      definitionId,
      status: 'created',
      name,
      symbol,
      timeframe,
      params: { ...def.defaultParameters, ...params },
      state: def.create(this._ctx, { ...def.defaultParameters, ...params }),
      signals: [],
      createdAt: now,
      updatedAt: now,
    }

    this._instances.set(id, instance)
    this._emit('instance:added', instance)
    return id
  }

  /** Start a strategy instance. */
  start(id: string): void {
    const inst = this._get(id)
    if (inst.status === 'running') return

    inst.status = 'running'
    inst.updatedAt = Date.now()
    this._emit('instance:started', inst)
  }

  /** Pause a strategy instance (retains state). */
  pause(id: string): void {
    const inst = this._get(id)
    if (inst.status !== 'running') throw new Error(`Cannot pause strategy in state: ${inst.status}`)

    inst.status = 'paused'
    inst.updatedAt = Date.now()
    this._emit('instance:paused', inst)
  }

  /** Stop a strategy instance. */
  stop(id: string): void {
    const inst = this._get(id)
    if (inst.status === 'stopped') return

    inst.status = 'stopped'
    inst.updatedAt = Date.now()
    this._emit('instance:stopped', inst)
  }

  /** Remove a strategy instance entirely. */
  remove(id: string): boolean {
    const inst = this._instances.get(id)
    if (!inst) return false
    this._instances.delete(id)
    this._emit('instance:removed', inst)
    return true
  }

  /** Remove all instances. */
  clear(): void {
    this._instances.clear()
    this._emit('instances:cleared')
  }

  // ── Tick / Bar Processing ──

  /**
   * Process a new bar for a running strategy instance.
   * Returns the signal if one was generated, or null.
   */
  tick(id: string, bar: StrategyBar): StrategySignal | null {
    const inst = this._get(id)
    if (inst.status !== 'running') return null

    const def = StrategyRegistry.get(inst.definitionId)
    if (!def) return null

    const signal = def.onBar(
      {
        bar,
        bars: [],
        timestamp: bar.timestamp,
      },
      this._ctx,
    )

    if (signal) {
      inst.signals.push(signal)
      inst.state = this._ctx.state
      inst.updatedAt = Date.now()
      this._emit('signal', signal, inst)
    }

    return signal
  }

  // ── Queries ──

  /** Get a single instance by id. */
  get(id: string): StrategyInstanceData | undefined {
    return this._instances.get(id)
  }

  /** Get all instances. */
  getAll(): readonly StrategyInstanceData[] {
    return [...this._instances.values()]
  }

  /** Get instances filtered by status. */
  getByStatus(status: StrategyStatus): readonly StrategyInstanceData[] {
    return this.getAll().filter((i) => i.status === status)
  }

  /** Get instances for a specific definition. */
  getByDefinition(definitionId: string): readonly StrategyInstanceData[] {
    return this.getAll().filter((i) => i.definitionId === definitionId)
  }

  /** Get running instances. */
  getRunning(): readonly StrategyInstanceData[] {
    return this.getByStatus('running')
  }

  /** Number of instances. */
  get count(): number {
    return this._instances.size
  }

  /** Number of running instances. */
  get runningCount(): number {
    return this.getByStatus('running').length
  }

  // ── Private ──

  private _get(id: string): StrategyInstanceData {
    const inst = this._instances.get(id)
    if (!inst) throw new Error(`Strategy instance not found: ${id}`)
    return inst
  }
}

export type StrategyRuntimeEvents = {
  'instance:added': StrategyInstanceData
  'instance:started': StrategyInstanceData
  'instance:paused': StrategyInstanceData
  'instance:stopped': StrategyInstanceData
  'instance:removed': StrategyInstanceData
  'instances:cleared': void
  signal: [StrategySignal, StrategyInstanceData]
}
