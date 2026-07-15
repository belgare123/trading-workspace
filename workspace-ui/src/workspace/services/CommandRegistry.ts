/**
 * CommandRegistry — central registry of workspace commands
 *
 * Each command has:
 *   id        — unique identifier (e.g. 'workspace.undo')
 *   title     — human-readable label
 *   category  — grouping ('panel', 'workspace', 'edit')
 *   shortcut  — optional keyboard shortcut (e.g. 'Ctrl+Z')
 *   execute   — action handler
 *   canExecute — optional guard (returns false when command is unavailable)
 *
 * @since 3.2.4
 */

export interface Command {
  id: string
  title: string
  category: string
  shortcut?: string
  /** Optional icon character */
  icon?: string
  /** Execute the command */
  execute: () => void
  /** Guard — return false to disable the command */
  canExecute?: () => boolean
}

export class CommandRegistry {
  private commands = new Map<string, Command>()
  private shortcutMap = new Map<string, string>() // normalized shortcut → commandId

  /** Register a single command */
  register(command: Command): void {
    this.commands.set(command.id, command)
    if (command.shortcut) {
      this.shortcutMap.set(this.normalizeShortcut(command.shortcut), command.id)
    }
  }

  /** Register multiple commands at once */
  registerAll(commands: Command[]): void {
    for (const cmd of commands) this.register(cmd)
  }

  /** Unregister a command by id */
  unregister(id: string): void {
    const cmd = this.commands.get(id)
    if (cmd?.shortcut) {
      this.shortcutMap.delete(this.normalizeShortcut(cmd.shortcut))
    }
    this.commands.delete(id)
  }

  /** Get command by id */
  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  /** Get all commands (optionally filtered by category) */
  getAll(category?: string): Command[] {
    const all = Array.from(this.commands.values())
    if (!category) return all
    return all.filter(c => c.category === category)
  }

  /** Get all unique categories */
  getCategories(): string[] {
    const cats = new Set<string>()
    for (const cmd of this.commands.values()) {
      cats.add(cmd.category)
    }
    return Array.from(cats).sort()
  }

  /**
   * Find a command by keyboard event.
   * Handles Ctrl/Meta, Shift, Alt modifiers.
   */
  matchShortcut(event: {
    ctrlKey: boolean
    metaKey: boolean
    shiftKey?: boolean
    altKey?: boolean
    key: string
  }): Command | undefined {
    const parts: string[] = []

    if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
    if (event.shiftKey) parts.push('Shift')
    if (event.altKey) parts.push('Alt')

    // Normalize key: single chars → uppercase, special keys as-is
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
    parts.push(key)

    const normalized = parts.join('+')
    const id = this.shortcutMap.get(normalized)
    return id ? this.commands.get(id) : undefined
  }

  /**
   * Execute a command by id.
   * Returns false if command doesn't exist or canExecute returns false.
   */
  execute(id: string): boolean {
    const cmd = this.commands.get(id)
    if (!cmd) return false
    if (cmd.canExecute && !cmd.canExecute()) return false
    cmd.execute()
    return true
  }

  /** Check if a command can be executed */
  canExecute(id: string): boolean {
    const cmd = this.commands.get(id)
    if (!cmd) return false
    return cmd.canExecute ? cmd.canExecute() : true
  }

  /** Normalize a shortcut string for internal matching */
  private normalizeShortcut(shortcut: string): string {
    return shortcut
      .split('+')
      .map(s => s.trim())
      .join('+')
  }
}
