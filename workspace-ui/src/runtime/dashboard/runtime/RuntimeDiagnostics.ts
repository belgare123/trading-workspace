/**
 * RuntimeDiagnostics — inspect every registry in the platform.
 *
 * Designed for DevTools, Debug overlay, and health checks.
 *
 * @since 3.1.2.7
 */

import { WidgetRegistry } from '../../WidgetRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { DataProviderRegistry } from '../data/DataProviderRegistry'
import { globalCommandRegistry } from '../../../commands/CommandRegistry'
import { globalSearchRegistry } from '../../../search/SearchRegistry'
import { Registry } from '../../Registry'

// ── Registry snapshot ──────────────────────────────────────────────

/** Snapshot of a single registry at a point in time. */
export interface RegistryReport {
  name: string
  count: number
  ids: string[]
  status: 'ok' | 'empty' | 'warn'
}

/** Full diagnostics report. */
export interface DiagnosticsReport {
  registries: RegistryReport[]
  totalEntries: number
  timestamp: number
}

// ── Registry definitions ───────────────────────────────────────────

interface RegistryDef {
  name: string
  registry: Registry<any>
  minExpected?: number
}

const ALL_REGISTRIES: RegistryDef[] = [
  { name: 'WidgetRegistry', registry: WidgetRegistry },
  { name: 'PresetRegistry', registry: PresetRegistry },
  { name: 'ScreenRegistry', registry: ScreenRegistry },
  { name: 'DataProviderRegistry', registry: DataProviderRegistry },
  { name: 'CommandRegistry', registry: globalCommandRegistry },
  { name: 'SearchRegistry', registry: globalSearchRegistry },
]

// ── API ────────────────────────────────────────────────────────────

/** Generate a full diagnostics report. */
export function generateReport(): DiagnosticsReport {
  const registries = ALL_REGISTRIES.map(snapshotOne)
  const totalEntries = registries.reduce((sum, r) => sum + r.count, 0)
  return { registries, totalEntries, timestamp: Date.now() }
}

/** Snapshot a single registry. */
function snapshotOne(def: RegistryDef): RegistryReport {
  const items = def.registry.getAll()
  const status: RegistryReport['status'] =
    items.length === 0 ? 'empty'
    : def.minExpected !== undefined && items.length < def.minExpected ? 'warn'
    : 'ok'

  return {
    name: def.name,
    count: items.length,
    ids: items.map((i: any) => i.id ?? i.title ?? '(unnamed)'),
    status,
  }
}

/** Get a specific entry from a registry by name + id. */
export function getEntry(name: string, id: string): unknown | undefined {
  const def = ALL_REGISTRIES.find((r) => r.name === name)
  if (!def) return undefined
  return def.registry.get(id)
}

/** Human-readable summary string. */
export function reportToString(report: DiagnosticsReport): string {
  const lines = ['╔══════════════════════════════════════╗', '║        Registry Diagnostics            ║', '╚══════════════════════════════════════╝', '']
  let total = 0
  for (const r of report.registries) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'warn' ? '⚠' : ' '
    lines.push(`  ${icon} ${r.name.padEnd(22)} ${String(r.count).padStart(3)} items`)
    total += r.count
  }
  lines.push('', `  Total: ${total} entries · ${report.registries.length} registries`, `  Timestamp: ${new Date(report.timestamp).toISOString()}`)
  return lines.join('\n')
}

// ── DevTools integration ───────────────────────────────────────────

/** Register a new external registry for diagnostics (e.g. TimelineRegistry, PluginLoader). */
export function registerForDiagnostics(name: string, registry: Registry<any>): void {
  if (!ALL_REGISTRIES.find((r) => r.name === name)) {
    ALL_REGISTRIES.push({ name, registry })
  }
}
