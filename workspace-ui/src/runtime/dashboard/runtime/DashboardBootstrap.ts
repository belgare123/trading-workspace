/**
 * DashboardBootstrap — prepares the Dashboard Runtime environment.
 *
 * Previously this was the single place that registered ALL providers,
 * widgets, presets, and screens. Under the Module System (v3.1.3.5),
 * content registration moves to individual ClientModule instances.
 *
 * This file now only:
 *   1. Sets up the RuntimeContext (bundled registry references)
 *   2. Provides the validateAll() step (called after all modules register)
 *
 * @since 3.1.3 — refactored in 3.1.3.5
 */

import { DataProviderRegistry } from '../data/DataProviderRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { WidgetRegistry } from '../../WidgetRegistry'
import { globalCommandRegistry } from '../../../commands/CommandRegistry'
import { globalSearchRegistry } from '../../../search/SearchRegistry'
import { DashboardValidator } from './DashboardValidator'
import type { RuntimeContext } from '../../modules/types'

/* ── Startup report shape ── */

export interface StartupReport {
  screens: number
  presets: number
  widgets: number
  providers: number
  duration: number
  validations: {
    ok: number
    errors: number
    warnings: number
  }
}

/* ── Runtime context factory ── */

/**
 * Build a RuntimeContext from the live registries.
 */
export function createRuntimeContext(): RuntimeContext {
  return {
    widgets: WidgetRegistry,
    providers: DataProviderRegistry,
    screens: ScreenRegistry,
    presets: PresetRegistry,
    commands: globalCommandRegistry,
    search: globalSearchRegistry,
  }
}

/* ── Bootstrap (teardown + setup) ── */

/**
 * Prepare the Dashboard Runtime environment.
 * - Clears all registries (safe for HMR / hot-reload)
 * - Returns the current registry state (may be empty on cold start)
 */
export function setupDashboardEnvironment(): StartupReport {
  // Clear registries for clean state (idempotent)
  WidgetRegistry.clear()
  DataProviderRegistry.clear()
  PresetRegistry.clear()
  ScreenRegistry.clear()

  return {
    screens: ScreenRegistry.count,
    presets: PresetRegistry.count,
    widgets: WidgetRegistry.getAll().length,
    providers: DataProviderRegistry.count,
    duration: 0,
    validations: { ok: 0, errors: 0, warnings: 0 },
  }
}

/* ── Validation ── */

/**
 * Validate all registries for integrity.
 * Call AFTER all modules have registered their resources and presentation.
 */
export function validateDashboard(): StartupReport['validations'] {
  const { results, errors, warnings } = DashboardValidator.validateAll()

  if (errors > 0 && import.meta.env.DEV) {
    console.warn(`[Dashboard] ⚠ ${errors} validation error(s) — see details below`)
    for (const r of results) {
      if (r.type === 'error') console.error(`  ✗ [${r.category}] ${r.message}${r.details ? '\n    ' + r.details : ''}`)
    }
  }
  if (warnings > 0 && import.meta.env.DEV) {
    for (const r of results) {
      if (r.type === 'warn') console.warn(`  ⚠ [${r.category}] ${r.message}`)
    }
  }

  return {
    ok: results.filter(r => r.type === 'info').length,
    errors,
    warnings,
  }
}
