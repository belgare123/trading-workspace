/**
 * DashboardRuntime — single entry point for the Dashboard subsystem.
 *
 * Under the Module System (v3.1.3.5), DashboardRuntime no longer
 * registers any content. It:
 *   1. Sets up the runtime environment (clear registries)
 *   2. Provides a RuntimeContext to PlatformBootstrap
 *   3. Validates after all modules register
 *
 * Chain:
 *   PlatformBootstrap.initialize([modules])
 *     ↓
 *   DashboardRuntime.setup()          ← clear registries
 *     ↓
 *   for each module:
 *     module.registerResources(ctx)   ← providers, widgets, commands, search
 *     module.registerPresentation(ctx) ← screens, presets
 *     ↓
 *   DashboardRuntime.validate()       ← integrity checks
 *     ↓
 *   Startup Report
 *
 * @since 3.1.2.7 — refactored in 3.1.3.5
 */

import { ScreenRegistry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { WidgetRegistry } from '../../WidgetRegistry'
import { DataProviderRegistry } from '../data/DataProviderRegistry'
import { EventRegistry } from '../../EventRegistry'
import { globalCommandRegistry } from '../../../commands/CommandRegistry'
import { globalSearchRegistry } from '../../../search/SearchRegistry'

import { setupDashboardEnvironment, validateDashboard } from './DashboardBootstrap'
import { DashboardValidator } from './DashboardValidator'
import type { RuntimeContext } from '../../modules/types'
import type { ValidationResult } from './DashboardValidator'

/* ── System report ── */

export interface SystemStartupReport {
  screens: number
  presets: number
  widgets: number
  providers: number
  commands: number
  searchAdapters: number
  eventTopics: number
  duration: number
  validations: {
    ok: number
    errors: number
    warnings: number
  }
  results: ValidationResult[]
}

/* ── Console render ── */

function renderReport(report: SystemStartupReport): void {
  const { duration, validations } = report
  const ok = validations.errors === 0 && validations.warnings === 0

  const lines = [
    '',
    '╔══════════════════════════════════════╗',
    '║      Runtime Dashboard Report        ║',
    '╚══════════════════════════════════════╝',
    '',
    `  Screens .......... ${String(report.screens).padStart(3)} ✓`,
    `  Presets .......... ${String(report.presets).padStart(3)} ✓`,
    `  Widgets .......... ${String(report.widgets).padStart(3)} ✓`,
    `  Providers ........ ${String(report.providers).padStart(3)} ✓`,
    `  Commands ......... ${String(report.commands).padStart(3)} ✓`,
    `  Search Adapters .. ${String(report.searchAdapters).padStart(3)} ✓`,
    `  Event Topics ..... ${String(report.eventTopics).padStart(3)} ✓`,
    '',
    `  Validations: ${validations.ok} ✓  ${validations.errors > 0 ? validations.errors + ' ✗' : '0 ✗'}  ${validations.warnings > 0 ? validations.warnings + ' ⚠' : '0 ⚠'}`,
    `  Startup: ${duration} ms  ${ok ? '✓' : '⚠'}`,
    '',
  ]

  console.log(lines.join('\n'))
}

/* ── Build report ── */

function buildReport(startTime: number): SystemStartupReport {
  const validations = validateDashboard()

  return {
    screens: ScreenRegistry.count,
    presets: PresetRegistry.count,
    widgets: WidgetRegistry.getAll().length,
    providers: DataProviderRegistry.count,
    commands: globalCommandRegistry.count,
    searchAdapters: globalSearchRegistry.count,
    eventTopics: EventRegistry.topics().length,
    duration: Math.round(performance.now() - startTime),
    validations,
    results: DashboardValidator.validateAll().results,
  }
}

/* ── Runtime ── */

export const DashboardRuntime = {
  /**
   * Set up the Dashboard Runtime environment.
   * Clears all registries and returns a RuntimeContext for modules.
   */
  setup(): RuntimeContext {
    setupDashboardEnvironment()

    return {
      widgets: WidgetRegistry,
      providers: DataProviderRegistry,
      screens: ScreenRegistry,
      presets: PresetRegistry,
      commands: globalCommandRegistry,
      search: globalSearchRegistry,
    }
  },

  /**
   * Validate registries and build a full startup report.
   * Call AFTER all modules have registered.
   */
  finalize(startTime: number): SystemStartupReport {
    const report = buildReport(startTime)

    if (import.meta.env.DEV) {
      renderReport(report)
    }

    return report
  },

  /** Access all underlying registries (for diagnostics) */
  registries: {
    screens: ScreenRegistry,
    presets: PresetRegistry,
    widgets: WidgetRegistry,
    providers: DataProviderRegistry,
  },
}
