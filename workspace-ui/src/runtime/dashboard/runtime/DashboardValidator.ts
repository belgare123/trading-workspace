/**
 * DashboardValidator — runtime validation of registry cross-references.
 *
 * Runs at boot (DEV) to catch broken links before they cause runtime errors:
 *   ScreenRegistry  →  PresetRegistry  →  WidgetRegistry  →  DataProviderRegistry
 *
 * Every registry contract is independently extensible.
 * Validators ensure they stay consistent.
 */

import { ScreenRegistry, type ScreenEntry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { WidgetRegistry } from '../../WidgetRegistry'
import { DataProviderRegistry } from '../data/DataProviderRegistry'

/* ── Validation result ── */

export type ValidationSeverity = 'error' | 'warn' | 'info'
export type ValidationCategory =
  | 'screen-entry'
  | 'screen-preset'
  | 'preset-widget'
  | 'widget-provider'
  | 'screen-completeness'

export interface ValidationResult {
  type: ValidationSeverity
  category: ValidationCategory
  message: string
  details?: string
}

/* ── Validator ── */

export class DashboardValidator {
  /**
   * Run ALL validations against every registry.
   */
  static validateAll(): { results: ValidationResult[]; errors: number; warnings: number } {
    const results: ValidationResult[] = [
      ...this.validateScreenEntries(),
      ...this.validateScreenPresets(),
      ...this.validatePresetWidgets(),
      ...this.validateWidgetProviders(),
    ]

    const errors = results.filter(r => r.type === 'error').length
    const warnings = results.filter(r => r.type === 'warn').length

    return { results, errors, warnings }
  }

  /**
   * Validate all registered ScreenEntries have required fields.
   */
  static validateScreenEntries(): ValidationResult[] {
    const results: ValidationResult[] = []
    const required: (keyof ScreenEntry)[] = ['id', 'title', 'icon', 'preset', 'category', 'order']

    for (const screen of ScreenRegistry.all()) {
      for (const field of required) {
        if (screen[field] == null) {
          results.push({
            type: 'error',
            category: 'screen-entry',
            message: `Screen '${screen.id}': missing '${field}'`,
            details: `Entry: ${JSON.stringify(screen)}`,
          })
        }
      }
    }

    if (results.length === 0) {
      results.push({
        type: 'info',
        category: 'screen-entry',
        message: `All ${ScreenRegistry.count} screens have valid entries`,
      })
    }

    return results
  }

  /**
   * Validate that every ScreenEntry's `preset` exists in PresetRegistry.
   */
  static validateScreenPresets(): ValidationResult[] {
    const results: ValidationResult[] = []

    for (const screen of ScreenRegistry.all()) {
      if (!screen.preset) {
        results.push({
          type: 'warn',
          category: 'screen-preset',
          message: `Screen '${screen.id}' has no preset — will use fallback rendering`,
        })
        continue
      }

      if (!PresetRegistry.has(screen.preset)) {
        results.push({
          type: 'error',
          category: 'screen-preset',
          message: `Screen '${screen.id}' references unknown preset '${screen.preset}'`,
          details: `Register the preset via PresetRegistry.register() before DashboardRuntime.initialize()`,
        })
      }
    }

    if (results.filter(r => r.type === 'error').length === 0) {
      results.push({
        type: 'info',
        category: 'screen-preset',
        message: `All screens reference valid presets`,
      })
    }

    return results
  }

  /**
   * Validate that every widget ID referenced in every preset exists in WidgetRegistry.
   * Optionally restrict to a single preset ID.
   */
  static validatePresetWidgets(presetId?: string): ValidationResult[] {
    const results: ValidationResult[] = []
    const presets = presetId
      ? [PresetRegistry.get(presetId)].filter((p): p is NonNullable<typeof p> => p != null)
      : PresetRegistry.getAll()

    if (presets.length === 0) {
      results.push({
        type: 'warn',
        category: 'preset-widget',
        message: 'No presets registered to validate',
      })
      return results
    }

    for (const preset of presets) {
      if (!preset.screens) continue

      for (const screen of preset.screens) {
        if (!screen.widgets) continue

        for (const widgetId of screen.widgets) {
          if (!WidgetRegistry.has(widgetId)) {
            results.push({
              type: 'error',
              category: 'preset-widget',
              message: `Missing widget '${widgetId}' in preset '${preset.id}' (screen '${screen.id}')`,
              details: `Register the widget via WidgetRegistry.register() or add it to registerDefaultWidgets()`,
            })
          }
        }
      }
    }

    if (results.filter(r => r.type === 'error').length === 0) {
      results.push({
        type: 'info',
        category: 'preset-widget',
        message: `All widget IDs in presets exist in WidgetRegistry`,
      })
    }

    return results
  }

  /**
   * Validate that every registered widget has a matching DataProvider.
   *
   * Uses a naming convention: provider ID = widget ID.
   * (e.g. widget 'kpi-strip' expects provider 'kpi-strip')
   */
  static validateWidgetProviders(): ValidationResult[] {
    const results: ValidationResult[] = []

    for (const widget of WidgetRegistry.getAll()) {
      if (!DataProviderRegistry.has(widget.id)) {
        results.push({
          type: 'warn',
          category: 'widget-provider',
          message: `Widget '${widget.id}' has no registered DataProvider`,
          details: `Register a DataProvider with id '${widget.id}' or the widget won't receive live data`,
        })
      }
    }

    if (results.length === 0) {
      results.push({
        type: 'info',
        category: 'widget-provider',
        message: `All widgets have matching DataProviders`,
      })
    }

    return results
  }
}
