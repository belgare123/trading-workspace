/**
 * WidgetRegistryApi — abstract interface for widget registry.
 *
 * ClientModule uses only this, never the concrete WidgetRegistryClass.
 * Allows swapping the backend: local → proxy → sandbox → remote.
 *
 * @since 3.1.3.5
 */

import type { WidgetDefinition } from '../../types'

export interface WidgetRegistryApi {
  register(def: WidgetDefinition): void
  unregister(id: string): boolean
  getAll(): WidgetDefinition[]
  get(id: string): WidgetDefinition | undefined
  has(id: string): boolean
  get count(): number
}
