import type { DashboardPreset, DashboardScreen, ScreenLayout } from './types'

/**
 * DashboardPresetBuilder — fluent helper for constructing presets.
 *
 * @example
 * ```ts
 * new DashboardPresetBuilder('executive-overview', 'Executive Overview')
 *   .describe('Main operational dashboard')
 *   .addScreen('overview', 'Overview', '3-column', [
 *     'market-chart',
 *     'portfolio-summary',
 *     'signal-feed',
 *   ])
 *   .build()
 * ```
 */
export class DashboardPresetBuilder {
  private _id: string
  private _title: string
  private _description = ''
  private _screens: DashboardScreen[] = []

  constructor(id: string, title: string) {
    if (!id || !title) {
      throw new Error('[DashboardPresetBuilder] id and title are required')
    }
    this._id = id
    this._title = title
  }

  describe(text: string): this {
    this._description = text
    return this
  }

  addScreen(id: string, title: string, layout: ScreenLayout, widgets: string[]): this {
    this._screens.push({ id, title, layout, widgets })
    return this
  }

  build(): DashboardPreset {
    return {
      id: this._id,
      title: this._title,
      description: this._description,
      screens: this._screens,
    }
  }
}

/** Validate a preset structure */
export function validatePreset(preset: DashboardPreset): string[] {
  const errors: string[] = []

  if (!preset.id) errors.push('Preset id is required')
  if (!preset.title) errors.push('Preset title is required')
  if (!preset.screens || preset.screens.length === 0) {
    errors.push('Preset must have at least one screen')
  }

  for (const [i, screen] of (preset.screens ?? []).entries()) {
    if (!screen.id) errors.push(`Screen[${i}] must have an id`)
    if (!['3-column', '2-column', 'single'].includes(screen.layout)) {
      errors.push(`Screen[${i}].layout must be one of: 3-column, 2-column, single`)
    }
    if (!screen.widgets || screen.widgets.length === 0) {
      errors.push(`Screen[${i}] must have at least one widget`)
    }
  }

  return errors
}
