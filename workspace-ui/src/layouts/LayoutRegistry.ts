import type { WorkspaceLayout } from './types'
import { DEFAULT_LAYOUTS } from './defaults'

const STORAGE_KEY = 'workspace-layouts'
const ACTIVE_KEY = 'workspace-layout-active'

type LayoutListener = (layouts: WorkspaceLayout[], activeId: string | null) => void

export class LayoutRegistry {
  private layouts: WorkspaceLayout[] = []
  private activeId: string | null = null
  private listeners = new Set<LayoutListener>()
  private initialized = false

  // ── Initialization ───────────────────────────────────────────────

  init(): void {
    if (this.initialized) return
    this.initialized = true

    // Try loading from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        this.layouts = this.migrate(JSON.parse(saved))
      } catch {
        this.layouts = this.cloneDefaults()
      }
    } else {
      this.layouts = this.cloneDefaults()
    }

    // Restore active layout
    const activeId = localStorage.getItem(ACTIVE_KEY)
    if (activeId && this.layouts.some((l) => l.id === activeId)) {
      this.activeId = activeId
    } else {
      this.activeId = 'default'
    }

    this.persist()
    this.notify()
  }

  // ── Accessors ────────────────────────────────────────────────────

  getAll(): WorkspaceLayout[] {
    return [...this.layouts]
  }

  getActive(): WorkspaceLayout | undefined {
    return this.layouts.find((l) => l.id === this.activeId)
  }

  getActiveId(): string | null {
    return this.activeId
  }

  get(id: string): WorkspaceLayout | undefined {
    return this.layouts.find((l) => l.id === id)
  }

  // ── CRUD ─────────────────────────────────────────────────────────

  create(name: string, baseId?: string): WorkspaceLayout {
    const base = baseId ? this.get(baseId) : this.getActive()
    const newId = `custom-${Date.now()}`

    const layout: WorkspaceLayout = base
      ? { ...base, id: newId, name, layoutVersion: 1 }
      : this.createDefault(newId, name)

    this.layouts.push(layout)
    this.persist()
    this.notify()
    return layout
  }

  duplicate(id: string, newName: string): WorkspaceLayout {
    const source = this.get(id)
    if (!source) throw new Error(`Layout not found: ${id}`)

    return this.create(newName, id)
  }

  update(id: string, patch: Partial<WorkspaceLayout>): void {
    const idx = this.layouts.findIndex((l) => l.id === id)
    if (idx < 0) return

    this.layouts[idx] = { ...this.layouts[idx], ...patch }
    this.persist()
    this.notify()
  }

  delete(id: string): void {
    if (id === 'default') return // cannot delete default
    this.layouts = this.layouts.filter((l) => l.id !== id)
    if (this.activeId === id) {
      this.activeId = 'default'
    }
    this.persist()
    this.notify()
  }

  activate(id: string): void {
    if (!this.layouts.some((l) => l.id === id)) return
    this.activeId = id
    localStorage.setItem(ACTIVE_KEY, id)
    this.notify()
  }

  resetToDefaults(): void {
    this.layouts = this.cloneDefaults()
    this.activeId = 'default'
    this.persist()
    this.notify()
  }

  // ── Export / Import ──────────────────────────────────────────────

  exportLayout(id: string): string {
    const layout = this.get(id)
    if (!layout) throw new Error(`Layout not found: ${id}`)
    return JSON.stringify(layout, null, 2)
  }

  importLayout(json: string): WorkspaceLayout {
    const data = JSON.parse(json)
    // Basic validation
    if (!data.id || !data.name || !data.views || !data.panels) {
      throw new Error('Invalid layout format')
    }
    const migrated = this.migrate([data])[0]
    // Ensure unique ID
    if (this.layouts.some((l) => l.id === migrated.id)) {
      migrated.id = `imported-${Date.now()}`
    }
    this.layouts.push(migrated)
    this.persist()
    this.notify()
    return migrated
  }

  // ── Auto-save ────────────────────────────────────────────────────

  autoSave(current: Omit<WorkspaceLayout, 'id' | 'name' | 'layoutVersion'>): void {
    const active = this.getActive()
    if (!active || active.id === 'default') return

    // Only auto-save custom layouts
    const idx = this.layouts.findIndex((l) => l.id === active.id)
    if (idx < 0) return

    this.layouts[idx] = {
      ...this.layouts[idx],
      views: current.views,
      panels: current.panels,
      sizes: current.sizes,
    }
    this.persist()
    // No notify on auto-save to avoid re-render loops
  }

  // ── Subscription ─────────────────────────────────────────────────

  onChange(fn: LayoutListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // ── Internal ─────────────────────────────────────────────────────

  private cloneDefaults(): WorkspaceLayout[] {
    return DEFAULT_LAYOUTS.map((l) => ({ ...l }))
  }

  private createDefault(id: string, name: string): WorkspaceLayout {
    return {
      id,
      name,
      layoutVersion: 1,
      views: { active: 'scanner', opened: ['scanner'] },
      panels: { inspector: true, timeline: false, sidebar: true },
      sizes: { sidebar: 220, inspector: 380, timeline: 140 },
      preferences: { theme: 'dark', density: 'comfortable' },
    }
  }

  private migrate(layouts: WorkspaceLayout[]): WorkspaceLayout[] {
    return layouts.map((l) => {
      // Future: handle layoutVersion upgrades
      if (!l.layoutVersion) l.layoutVersion = 1
      if (!l.preferences) l.preferences = { theme: 'dark', density: 'comfortable' }
      return l
    })
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.layouts))
      if (this.activeId) {
        localStorage.setItem(ACTIVE_KEY, this.activeId)
      }
    } catch {
      console.warn('[LayoutRegistry] Failed to persist layouts')
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn([...this.layouts], this.activeId))
  }
}

// ── Singleton ──────────────────────────────────────────────────────

export const globalLayoutRegistry = new LayoutRegistry()
