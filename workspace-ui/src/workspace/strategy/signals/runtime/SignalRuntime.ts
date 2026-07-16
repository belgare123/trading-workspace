// ── SignalRuntime — per-strategy signal evaluation manager ──
//
// Minimal runtime responsible for:
//   1. Registering which signals a strategy uses
//   2. Caching signal results within a single bar (tick)
//   3. Invalidating cache on new bar
//
// No business logic — just orchestration.
// The actual evaluation lives in SignalDefinition.evaluate().
//
// @since 3.4.3

import { SignalRegistry } from '../registry/SignalRegistry'
import type { SignalResult } from '../types'
import type { ExecutionContext } from '../../context'

export interface SignalBinding {
  signalId: string
  params: Record<string, unknown>
}

export class SignalRuntime {
  private readonly _bindings: SignalBinding[] = []
  private _cache = new Map<string, SignalResult>()
  private _currentBarTimestamp = 0

  /** Register signals that this strategy uses */
  bind(signalId: string, params?: Record<string, unknown>): void {
    if (!SignalRegistry.getInstance().has(signalId)) {
      throw new Error(`Signal not registered: ${signalId}`)
    }
    this._bindings.push({ signalId, params: params ?? {} })
  }

  /** Remove a signal binding */
  unbind(signalId: string): void {
    const idx = this._bindings.findIndex((b) => b.signalId === signalId)
    if (idx !== -1) this._bindings.splice(idx, 1)
    this._cache.delete(signalId)
  }

  /** Get all bound signal ids */
  get bindings(): readonly SignalBinding[] {
    return this._bindings
  }

  /**
   * Evaluate a single signal by id.
   * Returns cached result if available for current bar.
   */
  async evaluate(signalId: string, ctx: ExecutionContext): Promise<SignalResult> {
    const cached = this._getCached(signalId)
    if (cached) return cached

    const def = SignalRegistry.getInstance().get(signalId)
    if (!def) throw new Error(`Signal not registered: ${signalId}`)

    const binding = this._bindings.find((b) => b.signalId === signalId)
    const result = await def.evaluate(ctx, binding?.params ?? {})
    this._cache.set(signalId, result)
    return result
  }

  /** Evaluate all bound signals */
  async evaluateAll(ctx: ExecutionContext): Promise<Map<string, SignalResult>> {
    const results = new Map<string, SignalResult>()
    for (const binding of this._bindings) {
      results.set(binding.signalId, await this.evaluate(binding.signalId, ctx))
    }
    return results
  }

  /** Invalidate cache — call on each new bar */
  invalidate(timestamp: number): void {
    this._cache.clear()
    this._currentBarTimestamp = timestamp
  }

  /** Current bar timestamp */
  get currentBarTimestamp(): number {
    return this._currentBarTimestamp
  }

  // ── Private ──

  private _getCached(signalId: string): SignalResult | undefined {
    return this._cache.get(signalId)
  }
}
