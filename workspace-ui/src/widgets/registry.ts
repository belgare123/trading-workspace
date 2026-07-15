/* ═══════════════════════════════════════════════════════════════
   Widget Registry
   Spec: Workspace_UI_Architecture_v2.md §2.5
   ═══════════════════════════════════════════════════════════════ */

import type { Widget, WidgetCategory } from './types'

class WidgetRegistry {
  private widgets = new Map<string, Widget>()

  register(widget: Widget): void {
    if (this.widgets.has(widget.id)) {
      console.warn(`[Registry] Widget "${widget.id}" already registered — overwriting`)
    }
    this.widgets.set(widget.id, widget)
  }

  unregister(id: string): void {
    this.widgets.delete(id)
  }

  get(id: string): Widget | undefined {
    return this.widgets.get(id)
  }

  list(category?: WidgetCategory): Widget[] {
    const all = Array.from(this.widgets.values())
    return category ? all.filter((w) => w.category === category) : all
  }

  get all(): Widget[] {
    return Array.from(this.widgets.values())
  }

  clear(): void {
    this.widgets.clear()
  }
}

export const registry = new WidgetRegistry()
