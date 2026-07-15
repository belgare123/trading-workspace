/**
 * WorkspaceFoundationModule — generic infrastructure for all workspace clients.
 *
 * Registers:
 *   - 11 generic widgets (metrics, signals, event-flow, portfolio, pnl, …)
 *   - Built-in workspace commands (navigation, replay, view, system)
 *   - Search adapters (strategies, plugins, events, models, …)
 *
 * No screens or presets — this module provides reusable pieces that
 * other modules consume.
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from './types'
import { WidgetRegistry } from '../WidgetRegistry'
import { defaultWidgets } from '../registerDefaultWidgets'
import { registerBuiltInCommands } from '../../commands/builtin'
import { registerAllSearchAdapters } from '../../search/registerAdapters'
import { globalCommandRegistry } from '../../commands/CommandRegistry'
import { globalSearchRegistry } from '../../search/SearchRegistry'

export const WorkspaceFoundationModule: ClientModule = {
  id: 'workspace-foundation',
  name: 'Workspace Foundation',
  version: '3.1.3',
  description: 'Generic widgets, commands, and search adapters shared across all workspace screens',

  registerResources(_context: RuntimeContext): void {
    // 1. Generic widgets
    for (const def of defaultWidgets) {
      WidgetRegistry.register(def)
    }

    // 2. Built-in commands (directly on globalCommandRegistry — commands are not
    //    part of the Dashboard Runtime abstraction yet; they'll migrate later)
    registerBuiltInCommands()

    // 3. Search adapters
    registerAllSearchAdapters()

    if (import.meta.env.DEV) {
      console.log(
        `[workspace-foundation] Registered ${defaultWidgets.length} widgets, ` +
        `${globalCommandRegistry.count} commands, ` +
        `${globalSearchRegistry.count} search adapters`,
      )
    }
  },

  registerPresentation(): void {
    // Foundation provides no screens or presets
  },
}
