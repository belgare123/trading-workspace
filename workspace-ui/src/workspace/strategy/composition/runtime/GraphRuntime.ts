// ── GraphRuntime — Strategy Composition Engine runtime ──
//
// Composes SignalRuntime → ConditionRuntime → ActionRuntime
// through a strategy graph.
//
// Usage:
//   const runtime = new GraphRuntime()
//   runtime.load(graph)
//   await runtime.onBar(ctx, bar)
//
// @since 3.4.6

import { StrategyGraph } from '../graph/StrategyGraph'
import { GraphValidator } from '../graph/GraphValidator'
import { GraphScheduler } from './GraphScheduler'
import { GraphExecutor } from './GraphExecutor'
import type { GraphExecutionContext, GraphExecutionResult } from '../types'
import type { ExecutionContext } from '../../context'
import { ActionRuntime } from '../../actions'

export class GraphRuntime {
  private _graph: StrategyGraph | null = null
  readonly scheduler: GraphScheduler
  readonly executor: GraphExecutor
  private readonly _actionRuntime: ActionRuntime

  constructor() {
    this._actionRuntime = new ActionRuntime()
    this.executor = new GraphExecutor(this._actionRuntime)
    this.scheduler = new GraphScheduler()

    // Auto-wire scheduler to executor
    this.scheduler.on('onBar', async (_event, eventCtx) => {
      if (!this._graph) return
      const ctx = this._buildContext(eventCtx)
      await this.executor.execute(this._graph, ctx, eventCtx)
    })
  }

  /** Load a strategy graph */
  load(graph: StrategyGraph): { success: boolean; errors?: string[] } {
    const validation = GraphValidator.validate(graph)
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors.map(e => `[${e.code}] ${e.message}`),
      }
    }
    this._graph = graph
    return { success: true }
  }

  /** Unload the current graph */
  unload(): void {
    this._graph = null
    this.executor.clearConditionStates()
  }

  /** Check if a graph is loaded */
  get isLoaded(): boolean {
    return this._graph !== null
  }

  /** Get the loaded graph */
  get graph(): StrategyGraph | null {
    return this._graph
  }

  /** Process a bar event */
  async onBar(ctx: ExecutionContext, bar: GraphExecutionContext['bar']): Promise<GraphExecutionResult> {
    return this._run(ctx, { bar })
  }

  /** Process a tick event */
  async onTick(ctx: ExecutionContext, tick: GraphExecutionContext['tick']): Promise<GraphExecutionResult | null> {
    if (!this.scheduler.hasHandlers('onTick')) return null
    return this._run(ctx, { tick })
  }

  /** Process a trade event */
  async onTrade(ctx: ExecutionContext, trade: GraphExecutionContext['trade']): Promise<GraphExecutionResult | null> {
    if (!this.scheduler.hasHandlers('onTrade')) return null
    return this._run(ctx, { trade })
  }

  /** Process a custom event */
  async onCustomEvent(ctx: ExecutionContext, customEvent: GraphExecutionContext['customEvent']): Promise<GraphExecutionResult | null> {
    if (!this.scheduler.hasHandlers('onCustomEvent')) return null
    return this._run(ctx, { customEvent })
  }

  // ── Private ──

  private async _run(
    ctx: ExecutionContext,
    eventCtx: GraphExecutionContext,
  ): Promise<GraphExecutionResult> {
    if (!this._graph) {
      return {
        success: false,
        nodeResults: new Map(),
        timestamp: Date.now(),
        duration: 0,
        errors: [{ nodeId: 'graph', message: 'No graph loaded' }],
      }
    }

    return this.executor.execute(this._graph, ctx, eventCtx)
  }

  private _buildContext(_eventCtx: GraphExecutionContext): ExecutionContext {
    return {} as ExecutionContext
  }
}
