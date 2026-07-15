import Fuse from 'fuse.js'
import { Registry } from '../runtime/Registry'
import type { Command, CommandLogEntry } from './types'

// ── Registry ───────────────────────────────────────────────────────

export class CommandRegistry extends Registry<Command> {
  private fuse: Fuse<Command> | null = null
  private history: CommandLogEntry[] = []
  private historyLimit = 20
  private historyListeners = new Set<(h: CommandLogEntry[]) => void>()

  register(command: Command): void {
    super.register(command)
    this.rebuildIndex()
  }

  unregister(id: string): boolean {
    const result = super.unregister(id)
    this.rebuildIndex()
    return result
  }

  // ── Execute ──────────────────────────────────────────────────────

  async execute(id: string, params?: Record<string, unknown>): Promise<void> {
    const cmd = this.get(id)
    if (!cmd) {
      console.warn(`[CommandRegistry] Unknown command: "${id}"`)
      return
    }
    if (cmd.enabled && !cmd.enabled()) return

    // Log to history
    this.addToHistory({ commandId: id, title: cmd.title, timestamp: Date.now() })

    await cmd.run(params)
  }

  // ── Search ───────────────────────────────────────────────────────

  search(query: string): Command[] {
    if (!query.trim()) {
      // Return all visible commands sorted by category
      return this.getAll()
        .filter((c) => !c.visible || c.visible())
        .sort((a, b) => {
          if ((a.category ?? '') < (b.category ?? '')) return -1
          if ((a.category ?? '') > (b.category ?? '')) return 1
          return a.title.localeCompare(b.title)
        })
    }

    if (!this.fuse) return []

    const results = this.fuse.search(query)
    return results
      .map((r) => r.item)
      .filter((c) => !c.visible || c.visible())
  }

  // ── History ──────────────────────────────────────────────────────

  getHistory(): CommandLogEntry[] {
    return [...this.history]
  }

  clearHistory(): void {
    this.history = []
    this.notifyHistory()
  }

  onHistoryChange(fn: (h: CommandLogEntry[]) => void): () => void {
    this.historyListeners.add(fn)
    return () => this.historyListeners.delete(fn)
  }

  // ── Internal ─────────────────────────────────────────────────────

  private addToHistory(entry: CommandLogEntry): void {
    // Deduplicate consecutive runs
    const last = this.history[0]
    if (last && last.commandId === entry.commandId) {
      last.timestamp = entry.timestamp
    } else {
      this.history.unshift(entry)
      if (this.history.length > this.historyLimit) {
        this.history.pop()
      }
    }
    this.notifyHistory()
  }

  private notifyHistory(): void {
    const snapshot = [...this.history]
    this.historyListeners.forEach((fn) => fn(snapshot))
  }

  private rebuildIndex(): void {
    this.fuse = new Fuse(this.getAll(), {
      keys: [
        { name: 'title', weight: 3 },
        { name: 'keywords', weight: 2 },
        { name: 'subtitle', weight: 1 },
        { name: 'category', weight: 1 },
        { name: 'id', weight: 1 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
    })
  }
}

// ── Singleton ──────────────────────────────────────────────────────

/** Global singleton — use via CommandProvider / useCommands */
export const globalCommandRegistry = new CommandRegistry()
