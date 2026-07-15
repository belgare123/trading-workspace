/**
 * LayoutRegistry — manages named workspace layout presets
 *
 * Layouts here are blueprints (presets), not the active runtime state.
 * Active state lives in LayoutEngine + localStorage.
 *
 * @since 3.2.0
 */

import type { WorkspaceLayout, LayoutId } from './types'

interface LayoutEntry {
  layout: WorkspaceLayout
  description?: string
}

export class LayoutRegistry {
  private layouts = new Map<LayoutId, LayoutEntry>()

  register(layout: WorkspaceLayout, description?: string): void {
    if (this.layouts.has(layout.id)) {
      if (import.meta.env.DEV) {
        console.warn(`[LayoutRegistry] Overwriting '${layout.id}'`)
      }
    }
    this.layouts.set(layout.id, { layout, description })
  }

  unregister(id: LayoutId): boolean {
    return this.layouts.delete(id)
  }

  get(id: LayoutId): WorkspaceLayout | undefined {
    return this.layouts.get(id)?.layout
  }

  getAll(): WorkspaceLayout[] {
    return Array.from(this.layouts.values())
      .map(e => e.layout)
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  has(id: LayoutId): boolean {
    return this.layouts.has(id)
  }

  clear(): void {
    this.layouts.clear()
  }

  get count(): number {
    return this.layouts.size
  }

  get ids(): LayoutId[] {
    return Array.from(this.layouts.keys())
  }
}

/** Singleton — one registry for the app */
export const layoutRegistry = new LayoutRegistry()
