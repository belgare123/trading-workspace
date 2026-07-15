/**
 * Plugin Service API — v1.0.0
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Управление плагинами: установка, активация, деактивация.
 * Изменение сигнатур методов запрещено.
 */

export const PLUGIN_TOPICS = {
  INSTALL:   'plugin.install'   as const,
  ACTIVATE:  'plugin.activate'  as const,
  DEACTIVATE:'plugin.deactivate' as const,
  UNINSTALL: 'plugin.uninstall' as const,
  ERROR:     'plugin.error'     as const,
  CRASH:     'plugin.crash'     as const,
} as const

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  requires?: string[]
  permissions?: string[]
}

export interface PluginInfo {
  id: string
  name: string
  version: string
  status: 'installed' | 'active' | 'error' | 'disabled'
  health: number
  manifest: PluginManifest
}

export interface PluginApi {
  readonly id: 'plugin'

  /** Список установленных плагинов */
  list(): Promise<PluginInfo[]>

  /** Активировать плагин */
  enable(id: string): Promise<void>

  /** Деактивировать плагин */
  disable(id: string): Promise<void>

  /** Установить плагин из пути */
  install(path: string): Promise<void>

  /** Удалить плагин */
  uninstall(id: string): Promise<void>

  /** Получить Manifest плагина */
  manifest(id: string): Promise<PluginManifest>
}

export const PLUGIN_API_VERSION = '1.0.0'
