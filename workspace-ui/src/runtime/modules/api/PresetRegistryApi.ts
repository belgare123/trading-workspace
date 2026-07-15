/**
 * PresetRegistryApi — abstract interface for dashboard preset registry.
 *
 * ClientModule uses only this, never the concrete PresetRegistryClass.
 *
 * @since 3.1.3.5
 */

import type { DashboardPreset } from '../../dashboard/presets/types'

export interface PresetRegistryApi {
  register(preset: DashboardPreset): void
  unregister(id: string): boolean
  get(id: string): DashboardPreset | undefined
  getAll(): DashboardPreset[]
  has(id: string): boolean
  get count(): number
}
