/**
 * ClientModule — unified contract for all platform modules.
 *
 * Architecture Constitution v1.1:
 *   Every Layer-3 module (built-in, marketplace, enterprise, cloud)
 *   implements this interface. PlatformBootstrap iterates over a list
 *   of ClientModule instances and calls registerResources() then
 *   registerPresentation() for each.
 *
 * Separation:
 *   - registerResources: widgets, providers, commands, search, timeline
 *     (required — every module has at least resources)
 *   - registerPresentation: screens, presets, navigation, shortcuts
 *     (optional — Headless Runtime, Trading Lab may omit this)
 *
 * @example
 * ```ts
 * const MarketsModule: ClientModule = {
 *   id: 'markets',
 *   name: 'Markets',
 *   version: '3.1.3',
 *   dependsOn: ['workspace-foundation'],
 *   registerResources(ctx) {
 *     // providers + widgets
 *   },
 *   registerPresentation(ctx) {
 *     // screen + preset
 *   },
 * }
 * ```
 *
 * @since 3.1.3.5
 */

import type { WidgetRegistryApi } from './api/WidgetRegistryApi'
import type { DataProviderRegistryApi } from './api/DataProviderRegistryApi'
import type { ScreenRegistryApi } from './api/ScreenRegistryApi'
import type { PresetRegistryApi } from './api/PresetRegistryApi'
import type { CommandRegistryApi } from './api/CommandRegistryApi'
import type { SearchRegistryApi } from './api/SearchRegistryApi'

/**
 * RuntimeContext — abstract handle to all platform registries.
 *
 * Exposes only Api interfaces (not concrete classes) so the backend
 * can be swapped: local → proxy → sandbox → remote → test.
 */
export interface RuntimeContext {
  widgets: WidgetRegistryApi
  providers: DataProviderRegistryApi
  screens: ScreenRegistryApi
  presets: PresetRegistryApi
  commands: CommandRegistryApi
  search: SearchRegistryApi
}

/**
 * ClientModule — single unit of platform functionality.
 *
 * Every module MUST register resources. Presentation (screens, presets)
 * is optional for headless or non-dashboard clients.
 */
export interface ClientModule<
  TContext extends RuntimeContext = RuntimeContext,
> {
  /** Unique module identifier (e.g. 'markets', 'overview') */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** SemVer string */
  readonly version: string

  /** Optional description */
  readonly description?: string

  /**
   * Module dependencies — ids of modules that must be registered before
   * this one. PlatformBootstrap uses this to determine ordering.
   * Currently advisory; will power ModuleResolver in a future release.
   */
  readonly dependsOn?: readonly string[]

  /**
   * Register resources: widgets, data providers, commands, search adapters.
   * Called for EVERY module.
   */
  registerResources(context: TContext): void

  /**
   * Register presentation: screens, presets, navigation, shortcuts.
   * Optional — omit or no-op for headless / non-dashboard clients.
   */
  registerPresentation?(context: TContext): void

  /**
   * Optional cleanup. Called during hot-reload / module uninstall.
   */
  unregister?(context: TContext): void
}
