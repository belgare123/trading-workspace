// ── PaletteRuntime — Automatic palette from NodeRegistry ──
//
// No hardcoded node list. Reads SignalRegistry / ConditionRegistry /
// ActionRegistry through NodeRegistry and builds category-groups.
//
// @since 3.6.4

import { NodeRegistry } from '../../nodes/NodeRegistry'
import type { NodeDefinition } from '../../nodes/types'
import type { BuilderEventBus } from '../../runtime/BuilderEventBus'
import type { PaletteCategory, PaletteItem, ParameterDefinition } from '../types'
import { fromSignalParam } from '../types'

export class PaletteRuntime {
  private _eventBus: BuilderEventBus | null = null
  private _categories: PaletteCategory[] = []
  private _flatItems: PaletteItem[] = []
  private _nodeRegistry: NodeRegistry

  constructor(nodeRegistry?: NodeRegistry) {
    this._nodeRegistry = nodeRegistry ?? NodeRegistry.getInstance()
    this._rebuild()
  }

  connect(eventBus: BuilderEventBus): void {
    this._eventBus = eventBus
  }

  /** Rebuild palette from NodeRegistry — call when plugins register new items */
  refresh(): void {
    this._rebuild()
    this._eventBus?.emit('builder:palette:changed', undefined)
  }

  /** All palette categories */
  get categories(): PaletteCategory[] {
    return this._categories
  }

  /** Flat list for search */
  get allItems(): PaletteItem[] {
    return this._flatItems
  }

  /** Get an item by definition ID */
  getItem(defId: string): PaletteItem | undefined {
    return this._flatItems.find(i => i.id === defId)
  }

  /** Get category for a definition ID */
  getCategory(defId: string): string | undefined {
    const item = this.getItem(defId)
    return item?.category
  }

  /** Number of items */
  get size(): number {
    return this._flatItems.length
  }

  // ── Private ──

  private _rebuild(): void {
    const groups = this._nodeRegistry.getPalette()
    this._categories = groups.map(g => ({
      category: g.category,
      items: g.items.map(def => this._defToItem(def)),
    }))
    this._flatItems = this._categories.flatMap(c => c.items)
  }

  private _defToItem(def: NodeDefinition): PaletteItem {
    let params: ParameterDefinition[] | undefined

    // Extract parameters from the definition if it has getParameters()
    if (typeof (def as any).getParameters === 'function') {
      const raw = (def as any).getParameters() as any[]
      if (Array.isArray(raw)) {
        params = raw.map((p: any) => {
          // Accept both SignalParameter and raw {id, type, ...} shapes
          if (p.id !== undefined && p.type !== undefined) {
            return fromSignalParam(p)
          }
          return {
            id: String(p.id ?? ''),
            label: String(p.name ?? p.label ?? ''),
            type: (p.type as any) ?? 'string',
            defaultValue: p.default,
          }
        })
      }
    }

    return {
      id: def.id,
      label: def.typeName,
      type: this._inferType(def.category),
      category: def.category,
      icon: (def as any).icon,
      params,
    }
  }

  private _inferType(category: string): string {
    const lower = category.toLowerCase()
    if (lower.includes('signal')) return 'signal'
    if (lower.includes('condition')) return 'condition'
    if (lower.includes('action')) return 'action'
    if (lower.includes('group')) return 'group'
    return 'comment'
  }
}
