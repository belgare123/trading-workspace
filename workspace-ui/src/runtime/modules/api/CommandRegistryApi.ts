/**
 * CommandRegistryApi — abstract interface for command registry.
 *
 * ClientModule uses only this, never the concrete CommandRegistryClass.
 *
 * @since 3.1.3.5
 */

import type { Command } from '../../../commands/types'

export interface CommandRegistryApi {
  register(command: Command): void
  unregister(id: string): boolean
  get(id: string): Command | undefined
  getAll(): Command[]
  has(id: string): boolean
  get count(): number
}
