/**
 * Telemetry — no-op hooks for future usage analytics.
 *
 * All calls are no-ops by default.
 * To enable, replace `noopTelemetry` with a real implementation:
 *
 *   import { telemetry } from './telemetry'
 *   telemetry.emit = (event, payload) => {
 *     fetch('/api/v1/telemetry', { method: 'POST', body: JSON.stringify({ event, payload }) })
 *   }
 */

type EventPayload = Record<string, string | number | boolean>

// ── Public API ──────────────────────────────────────────────────────

function emit(event: string, payload?: EventPayload): void {
  // Future: replace with real analytics
  if (import.meta.env.DEV) {
    console.debug('[telemetry]', event, payload)
  }
}

// ── Convenience wrappers — keep these in sync with real usage ──────

export const Telemetry = {
  /** User opened command palette */
  commandPaletteOpen: () => emit('command.palette.open'),

  /** User executed a command */
  commandExecuted: (commandId: string) =>
    emit('command.executed', { commandId }),

  /** User performed a search query */
  searchQuery: (query: string, domain?: string) =>
    emit('search.query', { query: query.slice(0, 100), domain: domain ?? 'all' }),

  /** User switched workspace layout */
  layoutChanged: (layoutId: string) =>
    emit('layout.changed', { layoutId }),

  /** User created/duplicated/deleted a layout */
  layoutCreated: (name: string, fromBase?: string) =>
    emit('layout.created', { name, fromBase: fromBase ?? '' }),

  layoutDeleted: (layoutId: string) =>
    emit('layout.deleted', { layoutId }),

  /** Plugin installed/enabled/disabled */
  pluginInstalled: (pluginId: string) =>
    emit('plugin.installed', { pluginId }),

  pluginEnabled: (pluginId: string, enabled: boolean) =>
    emit('plugin.enabled', { pluginId, enabled }),

  /** Replay started/stopped */
  replayStarted: (replayId: string) =>
    emit('replay.started', { replayId }),

  replayStopped: (replayId: string) =>
    emit('replay.stopped', { replayId }),

  /** View navigation */
  viewChanged: (view: string) =>
    emit('view.changed', { view }),

  /** Timeline toggle */
  timelineToggled: (open: boolean) =>
    emit('timeline.toggled', { open }),

  /** Raw emit for ad-hoc events */
  emit,
}
