/**
 * SearchRegistryApi — abstract interface for search registry.
 *
 * ClientModule uses only this, never the concrete SearchRegistryClass.
 *
 * @since 3.1.3.5
 */

import type { SearchProvider } from '../../../search/types'

export interface SearchRegistryApi {
  register(provider: SearchProvider): void
  unregister(id: string): boolean
  get(id: string): SearchProvider | undefined
  getAll(): SearchProvider[]
  has(id: string): boolean
  get count(): number
}
