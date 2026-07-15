/**
 * RuntimeEvents — стандартные события Runtime
 *
 * @since 2.0.0
 * @version 2.0.0
 *
 * Все топики соответствуют Topic Convention:
 *   - domain.* (market.tick, strategy.signal, plugin.loaded)
 *   - Точка как разделитель namespace
 *   - Никаких произвольных строк
 *
 * Usage:
 *   import { RT } from './RuntimeEvents'
 *   runtime.events.emit(RT.plugin.loaded, { id: 'my-plugin' }, { source: 'PluginLoader' })
 *   runtime.events.on(RT.plugin.loaded, (event) => console.log(event.payload))
 */

export const RT = {
  // ── Runtime lifecycle ──
  runtime: {
    started:  'runtime.started',
    ready:    'runtime.ready',
    shutdown: 'runtime.shutdown',
    error:    'runtime.error',
  } as const,

  // ── Plugin lifecycle ──
  plugin: {
    installed:   'plugin.installed',
    validated:   'plugin.validated',
    loaded:      'plugin.loaded',
    activated:   'plugin.activated',
    ready:       'plugin.ready',
    sleeping:    'plugin.sleeping',
    resumed:     'plugin.resumed',
    deactivated: 'plugin.deactivated',
    unloaded:    'plugin.unloaded',
    removed:     'plugin.removed',
    failed:      'plugin.failed',
    blocked:     'plugin.blocked',
    crashed:     'plugin.crashed',
  } as const,

  // ── Widget lifecycle ──
  widget: {
    created:    'widget.created',
    destroyed:  'widget.destroyed',
    changed:    'widget.changed',
    pinned:     'widget.pinned',
    fullscreen: 'widget.fullscreen',
  } as const,

  // ── Layout ──
  layout: {
    changed:       'layout.changed',
    presetApplied: 'layout.preset-applied',
    reset:         'layout.reset',
  } as const,

  // ── Services ──
  service: {
    connected:    'service.connected',
    disconnected: 'service.disconnected',
    error:        'service.error',
  } as const,

  // ── Data ──
  data: {
    marketUpdate: 'data.market-update',
    signal:       'data.signal',
    trade:        'data.trade',
    notification: 'data.notification',
  } as const,
} as const

/** Тип для всех стандартных событий */
export type RuntimeEventName =
  | typeof RT.runtime[keyof typeof RT.runtime]
  | typeof RT.plugin[keyof typeof RT.plugin]
  | typeof RT.widget[keyof typeof RT.widget]
  | typeof RT.layout[keyof typeof RT.layout]
  | typeof RT.service[keyof typeof RT.service]
  | typeof RT.data[keyof typeof RT.data]
