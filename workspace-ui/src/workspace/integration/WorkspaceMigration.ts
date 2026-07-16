/**
 * WorkspaceMigration.ts — Workspace session version migration
 *
 * Handles schema upgrades for WorkspaceSession across platform versions.
 * Each migration function transforms a session from version N to N+1.
 *
 * @since 3.7.1
 */

import type { WorkspaceSession } from './WorkspaceSession'

// ── Migration function type ──

type MigrationFn = (session: Record<string, unknown>) => Record<string, unknown> | null

// ── Registry of migrations (index = from version) ──

const migrations: MigrationFn[] = [
  // v0 -> v1: initial schema stabilization
  function v0toV1(session: Record<string, unknown>): Record<string, unknown> | null {
    const s = { ...session }
    s.version = 1

    // Ensure layout exists
    if (!s.layout || typeof s.layout !== 'object') {
      s.layout = {
        layouts: {},
        activeLayout: 'default',
        theme: 'dark',
        sidebarPinned: true,
        version: 1,
      }
    }

    // Normalize layout structure
    const layout = s.layout as Record<string, unknown>
    if (!layout.layouts) layout.layouts = {}
    if (!layout.activeLayout) layout.activeLayout = 'default'
    if (layout.version === undefined || layout.version === null) layout.version = 1

    // Ensure sub-sections exist
    if (!s.charts) s.charts = {}
    if (!s.strategies) s.strategies = {}
    if (!s.builders) s.builders = {}
    if (!s.backtests) s.backtests = {}
    if (!s.optimizations) s.optimizations = {}
    if (!s.reports) s.reports = {}

    return s
  },
]

// ── Migration service ──

export class WorkspaceMigration {
  /**
   * Migrate a session from sourceVersion to targetVersion.
   * Returns null if any step fails.
   */
  migrate(
    session: Record<string, unknown>,
    sourceVersion: number,
    targetVersion: number,
  ): WorkspaceSession | null {
    let current = { ...session }

    for (let v = sourceVersion; v < targetVersion; v++) {
      const migrator = migrations[v]
      if (!migrator) {
        console.error(`[WorkspaceMigration] No migrator for v${v} -> v${v + 1}`)
        return null
      }
      try {
        const result = migrator(current)
        if (!result) {
          console.error(`[WorkspaceMigration] v${v} -> v${v + 1} failed`)
          return null
        }
        current = result
      } catch (err) {
        console.error(`[WorkspaceMigration] v${v} -> v${v + 1} threw`, err)
        return null
      }
    }

    return current as unknown as WorkspaceSession
  }

  /**
   * Check if a version needs migration.
   */
  needsMigration(version: number): boolean {
    return version < migrations.length
  }

  /**
   * Current latest version.
   */
  get latestVersion(): number {
    return migrations.length
  }
}

// ── Singleton ──

export const workspaceMigration = new WorkspaceMigration()
