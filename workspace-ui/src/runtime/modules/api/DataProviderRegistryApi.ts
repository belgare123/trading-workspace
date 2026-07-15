/**
 * DataProviderRegistryApi — abstract interface for data provider registry.
 *
 * ClientModule uses only this, never the concrete DataProviderRegistryClass.
 *
 * @since 3.1.3.5
 */

import type { WidgetDataProvider } from '../../dashboard/data/DataProviderRegistry'

export interface DataProviderRegistryApi {
  register(provider: WidgetDataProvider): void
  unregister(id: string): boolean
  get<T = unknown>(id: string): WidgetDataProvider<T> | undefined
  getAll(): WidgetDataProvider[]
  has(id: string): boolean
  get count(): number
}
