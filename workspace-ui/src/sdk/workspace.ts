/**
 * Workspace SDK — unified entry point for plugin developers.
 *
 * Provides:
 *   Workspace.registerCommand()
 *   Workspace.registerSearchAdapter()
 *   Workspace.registerPanel()
 *   Workspace.registerTimelineEvent()
 *   Workspace.notify()
 *
 * All methods are thin wrappers over internal registries.
 */

import { globalCommandRegistry } from '../commands/CommandRegistry'
import { globalSearchRegistry } from '../search/SearchRegistry'
import { globalPanelRegistry } from './PanelRegistry'
import { useTimelineStore } from '../timeline/TimelineStore'
import type {
  SdkCommand,
  SdkSearchAdapter,
  SdkPanel,
  SdkTimelineEvent,
  SdkNotification,
} from './types'
import type { Command } from '../commands/types'
import type { SearchProvider } from '../search/types'

// ── Notification observer ───────────────────────────────────────────

type NotificationSink = (n: SdkNotification) => void
const notificationSinks = new Set<NotificationSink>()

function notifySinks(notification: SdkNotification): void {
  for (const sink of notificationSinks) {
    try {
      sink(notification)
    } catch (err) {
      console.error('[Workspace SDK] Notification sink error:', err)
    }
  }
}

// ── Workspace API ───────────────────────────────────────────────────

export const Workspace = {
  // ── Commands ──────────────────────────────────────────────────────

  registerCommand(cmd: SdkCommand): void {
    const internal: Command = {
      id: cmd.id,
      title: cmd.title,
      subtitle: cmd.subtitle,
      category: cmd.category,
      shortcut: cmd.shortcut,
      icon: cmd.icon,
      run: cmd.execute,
    }
    globalCommandRegistry.register(internal)
  },

  unregisterCommand(id: string): void {
    globalCommandRegistry.unregister(id)
  },

  // ── Search ────────────────────────────────────────────────────────

  registerSearchAdapter(adapter: SdkSearchAdapter): void {
    const internal: SearchProvider = {
      id: adapter.id,
      name: adapter.title,
      search: async (query: string) => {
        const results = await adapter.search(query)
        return results.map((r, i) => ({
          id: `${adapter.id}:${i}`,
          domain: adapter.domain,
          title: r.title,
          description: r.description,
          url: r.url,
          icon: r.icon,
          score: 1,
        }))
      },
    }
    globalSearchRegistry.register(internal)
  },

  unregisterSearchAdapter(id: string): void {
    globalSearchRegistry.unregister(id)
  },

  // ── Panels ────────────────────────────────────────────────────────

  registerPanel(panel: SdkPanel): void {
    globalPanelRegistry.register({
      id: panel.id,
      title: panel.title,
      icon: panel.icon,
      render: panel.render,
      width: panel.width,
    })
  },

  unregisterPanel(id: string): void {
    globalPanelRegistry.unregister(id)
  },

  // ── Timeline ──────────────────────────────────────────────────────

  /** Push a timeline event into the global timeline feed. */
  pushTimelineEvent(event: SdkTimelineEvent): void {
    useTimelineStore.getState().addEvent({
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      title: event.title,
      description: event.description,
      channel: 'system',
      severity: 'info',
    })
  },

  // ── Notifications ─────────────────────────────────────────────────

  registerNotificationSink(sink: (notification: SdkNotification) => void): void {
    notificationSinks.add(sink)
  },

  unregisterNotificationSink(sink: (notification: SdkNotification) => void): void {
    notificationSinks.delete(sink)
  },

  /** Emit a notification to all registered sinks. */
  notify(notification: SdkNotification): void {
    notifySinks(notification)
  },
}
