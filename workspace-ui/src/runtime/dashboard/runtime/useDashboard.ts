'use client'

import { useMemo } from 'react'
import { PresetRegistry } from '../presets/PresetRegistry'
import type { DashboardPreset } from '../presets/types'

/**
 * useDashboard — resolve a preset by ID.
 *
 * Simple hook; returns undefined while the preset is unknown
 * so the renderer can show a loading/not-found state.
 */
export function useDashboard(presetId: string): DashboardPreset | undefined {
  return useMemo(() => PresetRegistry.get(presetId), [presetId])
}
