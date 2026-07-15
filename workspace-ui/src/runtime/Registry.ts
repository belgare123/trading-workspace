/**
 * Registry<T> — abstract generic base for all platform registries.
 *
 * Every registry in the Runtime follows the same contract:
 *   register → unregister → get → getAll → has → clear → count
 *
 * Extend this class for any registry that manages identifiables.
 *
 * @example
 * ```ts
 * class WidgetRegistry extends Registry<WidgetDefinition> {
 *   categories() { ... }
 * }
 * ```
 */

/** Minimal contract — every registry entry must have a unique string id. */
export interface Identifiable {
  id: string
}

/** Core registry implementation — shared by 7+ registries. */
export abstract class Registry<T extends Identifiable> {
  /** Internal storage. Protected so subclasses can iterate for extended queries. */
  protected items = new Map<string, T>()

  /**
   * Register an entry. Warns on overwrite.
   * Override in subclasses if the param type differs from the stored type.
   */
  register(item: T): void {
    if (this.items.has(item.id)) {
      if (import.meta.env.DEV) {
        console.warn(`[${this.constructor.name}] Overwriting '${item.id}'`)
      }
    }
    this.items.set(item.id, item)
  }

  /** Unregister an entry by id. Returns true if it existed. */
  unregister(id: string): boolean {
    return this.items.delete(id)
  }

  /** Look up a single entry. */
  get(id: string): T | undefined {
    return this.items.get(id)
  }

  /** Get all registered entries (sorted by id for determinism). */
  getAll(): T[] {
    return Array.from(this.items.values()).sort((a, b) => a.id.localeCompare(b.id))
  }

  /** Quick existence check. */
  has(id: string): boolean {
    return this.items.has(id)
  }

  /** Remove every entry (useful for testing / hot-reload). */
  clear(): void {
    this.items.clear()
  }

  /** Number of registered entries. */
  get count(): number {
    return this.items.size
  }

  /** Get all registered entry ids. */
  get ids(): string[] {
    return Array.from(this.items.keys())
  }
}
