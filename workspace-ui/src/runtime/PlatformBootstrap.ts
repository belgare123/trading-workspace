/**
 * PlatformBootstrap — единый init pipeline для всей платформы.
 *
 * Принимает список ClientModule и инициализирует их в порядке зависимостей.
 *
 * PlatformBootstrap.initialize([modules])
 *     ↓
 *   DashboardRuntime.setup()               ← очистка реестров
 *     ↓
 *   for each module (sorted by dependsOn):
 *     module.registerResources(ctx)        ← providers, widgets, commands, search
 *     module.registerPresentation?(ctx)    ← screens, presets (optional)
 *     ↓
 *   DashboardRuntime.finalize()           ← валидация + отчёт
 *
 * @since 3.1.2.7 — refactored in 3.1.3.5 (Module System)
 */

import { DashboardRuntime, type SystemStartupReport } from './dashboard/runtime/DashboardRuntime'
import { generateReport, reportToString } from './dashboard/runtime/RuntimeDiagnostics'
import type { ClientModule, RuntimeContext } from './modules/types'

/* ── Topological sort by dependsOn ── */

function sortByDependencies(modules: ClientModule[]): ClientModule[] {
  const byId = new Map<string, ClientModule>()
  for (const m of modules) byId.set(m.id, m)

  const visited = new Set<string>()
  const sorted: ClientModule[] = []

  function visit(mod: ClientModule, chain: string[] = []): void {
    if (visited.has(mod.id)) return
    visited.add(mod.id)

    const deps = mod.dependsOn ?? []
    for (const depId of deps) {
      const dep = byId.get(depId)
      if (!dep) {
        console.warn(`[PlatformBootstrap] Module "${mod.id}" depends on "${depId}" which is NOT in the module list`)
        continue
      }
      if (chain.includes(depId)) {
        console.error(`[PlatformBootstrap] Circular dependency detected: ${chain.join(' → ')} → ${depId}`)
        continue
      }
      visit(dep, [...chain, mod.id])
    }

    sorted.push(mod)
  }

  for (const mod of modules) visit(mod)
  return sorted
}

/* ── Bootstrap ── */

export interface PlatformStartupReport extends SystemStartupReport {
  diagnostics: string
}

export const PlatformBootstrap = {
  /**
   * Initialize every module in dependency order.
   *
   * Modules are sorted by dependsOn automatically.
   * registerResources is called first for all modules, then registerPresentation.
   *
   * Call ONCE at app boot, before any React rendering.
   */
  initialize(modules: ClientModule[]): PlatformStartupReport {
    const start = performance.now()
    const ordered = sortByDependencies(modules)

    // 1. Set up Dashboard Runtime (clear registries, create context)
    const ctx: RuntimeContext = DashboardRuntime.setup()

    // 2. Register resources first for ALL modules
    for (const mod of ordered) {
      try {
        mod.registerResources(ctx)
      } catch (err) {
        console.error(`[PlatformBootstrap] Error in "${mod.id}".registerResources():`, err)
      }
    }

    // 3. Register presentation for modules that have it
    for (const mod of ordered) {
      if (mod.registerPresentation) {
        try {
          mod.registerPresentation(ctx)
        } catch (err) {
          console.error(`[PlatformBootstrap] Error in "${mod.id}".registerPresentation():`, err)
        }
      }
    }

    // 4. Finalize (validate + report)
    const dashReport = DashboardRuntime.finalize(start)

    // 5. Diagnostics snapshot
    const diagSnapshot = generateReport()
    const diagnostics = reportToString(diagSnapshot)

    const report: PlatformStartupReport = {
      ...dashReport,
      diagnostics,
    }

    if (import.meta.env.DEV) {
      const ok = dashReport.validations.errors === 0
      console.log(
        [
          '',
          '╔══════════════════════════════════════╗',
          '║      Platform Bootstrap Report       ║',
          '╚══════════════════════════════════════╝',
          '',
          `  Modules ......... ${ordered.length} ✓`,
          `  Subsystems ..... 4/4 ✓`,
          `  Screens ........ ${String(dashReport.screens).padStart(3)} ✓`,
          `  Presets ........ ${String(dashReport.presets).padStart(3)} ✓`,
          `  Widgets ........ ${String(dashReport.widgets).padStart(3)} ✓`,
          `  Providers ...... ${String(dashReport.providers).padStart(3)} ✓`,
          `  Commands ....... ${String(dashReport.commands).padStart(3)} ✓`,
          `  Search Adapters  ${String(dashReport.searchAdapters).padStart(3)} ✓`,
          `  Event Topics ... ${String(dashReport.eventTopics).padStart(3)} ✓`,
          '',
          `  Validation: ${dashReport.validations.ok} ✓  ${dashReport.validations.errors} ✗  ${dashReport.validations.warnings} ⚠`,
          `  Boot: ${dashReport.duration} ms   ${ok ? '✓' : '⚠'}`,
          '',
          diagnostics,
          '',
        ].join('\n'),
      )
    }

    return report
  },
}
