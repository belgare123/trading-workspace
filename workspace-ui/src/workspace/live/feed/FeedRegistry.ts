/**
 * FeedRegistry.ts — Registry of available feed adapters
 *
 * Manages feed adapter lifecycle: register, resolve, activate/deactivate.
 *
 * @since 4.2
 */

import type { FeedAdapter } from '../adapters/FeedAdapter'

export class FeedRegistry {
  private adapters = new Map<string, FeedAdapter>()
  private activeAdapterId: string | null = null

  /** Register a feed adapter */
  register(adapter: FeedAdapter): void {
    if (this.adapters.has(adapter.id)) {
      console.warn(`[FeedRegistry] Overwriting existing adapter: ${adapter.id}`)
    }
    this.adapters.set(adapter.id, adapter)
  }

  /** Unregister a feed adapter */
  unregister(adapterId: string): void {
    this.adapters.delete(adapterId)
    if (this.activeAdapterId === adapterId) {
      this.activeAdapterId = null
    }
  }

  /** Get a registered adapter by id */
  get(adapterId: string): FeedAdapter | undefined {
    return this.adapters.get(adapterId)
  }

  /** Set the active adapter */
  setActive(adapterId: string): void {
    if (!this.adapters.has(adapterId)) {
      throw new Error(`[FeedRegistry] Adapter not registered: ${adapterId}`)
    }
    this.activeAdapterId = adapterId
  }

  /** Get the active adapter */
  getActive(): FeedAdapter | undefined {
    if (!this.activeAdapterId) return undefined
    return this.adapters.get(this.activeAdapterId)
  }

  /** List all registered adapters */
  list(): FeedAdapter[] {
    return Array.from(this.adapters.values())
  }

  /** Check if an adapter is registered */
  has(adapterId: string): boolean {
    return this.adapters.has(adapterId)
  }

  /** Get count of registered adapters */
  get size(): number {
    return this.adapters.size
  }

  /** Remove all adapters */
  clear(): void {
    this.adapters.clear()
    this.activeAdapterId = null
  }
}
