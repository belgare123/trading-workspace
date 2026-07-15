import { Registry } from '../../Registry'
import type { DashboardPreset } from './types'

/**
 * PresetRegistry — singleton registry for dashboard presets.
 *
 * Stores DashboardPreset directly (drops the PresetEntry wrapper —
 * the `created` timestamp was never consumed externally).
 */
class PresetRegistryClass extends Registry<DashboardPreset> {
  // register/get/getAll/has/unregister/clear/count inherited from Registry
}

/** Singleton instance */
export const PresetRegistry = new PresetRegistryClass()
