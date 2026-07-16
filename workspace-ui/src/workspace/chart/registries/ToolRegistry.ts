/**
 * ToolRegistry.ts — registry of drawing tools
 *
 * Drawing tools (trend line, fib, rectangle, text, etc.)
 * are registered at bootstrap or dynamically.
 *
 * @since 3.3.1
 */

import type { ToolMeta } from '../types'

/**
 * In-memory registry of available drawing tools.
 */
export class ToolRegistry {
  private readonly _tools = new Map<string, ToolMeta>()

  /** Register a single drawing tool */
  register(meta: ToolMeta): void {
    if (this._tools.has(meta.id)) {
      console.warn(`[ToolRegistry] Overwriting tool '${meta.id}'`)
    }
    this._tools.set(meta.id, meta)
  }

  /** Register multiple tools at once */
  registerAll(metas: ToolMeta[]): void {
    for (const meta of metas) {
      this.register(meta)
    }
  }

  /** Get tool meta by id */
  get(id: string): ToolMeta | undefined {
    return this._tools.get(id)
  }

  /** All registered tools */
  getAll(): ToolMeta[] {
    return Array.from(this._tools.values())
  }

  /** Check if a tool id exists */
  has(id: string): boolean {
    return this._tools.has(id)
  }

  /** Number of registered tools */
  get size(): number {
    return this._tools.size
  }
}

// ── Singleton ──

export const toolRegistry = new ToolRegistry()
