// ── SignalRegistry — singleton registry for signal definitions ──
//
// Pattern: SignalDefinition → SignalRegistry
// Same pattern as OverlayRegistry, IndicatorRegistry, StrategyRegistry.
//
// @since 3.4.3

import type { SignalDefinition } from '../definition/SignalDefinition'

export class SignalRegistry {
  private static _instance: SignalRegistry
  private readonly _definitions = new Map<string, SignalDefinition>()

  static getInstance(): SignalRegistry {
    if (!SignalRegistry._instance) {
      SignalRegistry._instance = new SignalRegistry()
    }
    return SignalRegistry._instance
  }

  /** Register a signal definition */
  register(def: SignalDefinition): void {
    if (this._definitions.has(def.id)) {
      throw new Error(`Signal already registered: ${def.id}`)
    }
    this._definitions.set(def.id, def)
  }

  /** Get a signal definition by id */
  get(id: string): SignalDefinition | undefined {
    return this._definitions.get(id)
  }

  /** Check if a signal is registered */
  has(id: string): boolean {
    return this._definitions.has(id)
  }

  /** Get all registered signal ids */
  get ids(): readonly string[] {
    return [...this._definitions.keys()]
  }

  /** Get all registered signal definitions */
  getAll(): readonly SignalDefinition[] {
    return [...this._definitions.values()]
  }

  /** Number of registered signals */
  get count(): number {
    return this._definitions.size
  }

  /** Clear all registered signals (useful for testing) */
  clear(): void {
    this._definitions.clear()
  }
}
