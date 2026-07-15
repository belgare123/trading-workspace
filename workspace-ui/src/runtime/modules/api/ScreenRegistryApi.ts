/**
 * ScreenRegistryApi — abstract interface for screen registry.
 *
 * ClientModule uses only this, never the concrete ScreenRegistryClass.
 *
 * @since 3.1.3.5
 */

import type { ScreenEntry } from '../../dashboard/screen/ScreenRegistry'

export interface ScreenRegistryApi {
  register(entry: ScreenEntry): void
  unregister(id: string): boolean
  get(id: string): ScreenEntry | undefined
  getAll(): ScreenEntry[]
  has(id: string): boolean
  get count(): number
}
