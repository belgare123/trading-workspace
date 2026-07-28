/**
 * CommandRegistry.ts — 2.0.5 Command System.
 *
 * Universal command bus. Any module can register commands.
 * AI can execute commands through the same API.
 * Keyboard shortcuts route through here.
 * The Command Palette UI renders from here.
 */

import type { Command, CommandContext, CommandRegistryApi, WorkspaceApi } from './types'

type CommandMap = Map<string, Command>

let commands: CommandMap = new Map()

/**
 * Create the command registry API bound to a workspace API instance.
 * Commands receive the workspace API as context when executed.
 */
export function createCommandRegistry(workspaceApi: WorkspaceApi): CommandRegistryApi {
  return {
    register(command: Command) {
      commands.set(command.id, command)
    },

    unregister(commandId: string) {
      commands.delete(commandId)
    },

    get(commandId: string): Command | undefined {
      return commands.get(commandId)
    },

    list(category?: string): Command[] {
      const all = Array.from(commands.values())
      if (category) {
        return all.filter(c => c.category === category)
      }
      return all
    },

    async execute(commandId: string) {
      const cmd = commands.get(commandId)
      if (!cmd) {
        console.warn(`[CommandRegistry] Unknown command: ${commandId}`)
        return
      }
      const ctx: CommandContext = { commandId, workspace: workspaceApi }
      try {
        await cmd.handler(ctx)
      } catch (err) {
        console.error(`[CommandRegistry] Error executing ${commandId}:`, err)
      }
    },

    search(query: string): Command[] {
      const q = query.toLowerCase()
      return Array.from(commands.values()).filter(
        c =>
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.category ?? '').toLowerCase().includes(q),
      )
    },
  }
}

/**
 * Reset the command registry (for testing / workspace teardown).
 */
export function _resetCommands(newMap?: Map<string, Command>): void {
  commands = newMap ?? new Map()
}