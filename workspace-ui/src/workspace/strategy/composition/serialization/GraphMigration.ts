// ── GraphMigration — version migration for strategy graphs ──
//
// Handles upgrading strategy graphs from older schema versions
// to the latest format.
//
// @since 3.4.6

import { CURRENT_SCHEMA_VERSION } from './GraphSchema'

export interface MigrationStep {
  from: string
  to: string
  migrate: (data: Record<string, unknown>) => Record<string, unknown>
}

const MIGRATIONS: MigrationStep[] = [
  // Future migrations go here:
  // { from: '0.9.0', to: '1.0.0', migrate: (data) => ({ ...data, version: '1.0.0' }) },
]

export class GraphMigration {
  /**
   * Migrate a graph data object to the latest schema version.
   * Returns the migrated data (no-op if already current).
   */
  static migrate(data: Record<string, unknown>): Record<string, unknown> {
    const currentVersion = (data.version as string) ?? '0.0.0'

    if (currentVersion === CURRENT_SCHEMA_VERSION) {
      return data // Already up to date
    }

    let migrated = { ...data }

    // Apply migrations sequentially
    for (const step of MIGRATIONS) {
      if (step.from === (migrated.version as string)) {
        migrated = step.migrate(migrated)
      }
    }

    // If no migration chain matched, warn but don't fail
    if ((migrated.version as string) !== CURRENT_SCHEMA_VERSION) {
      console.warn(
        `[GraphMigration] Could not migrate from ${currentVersion} to ${CURRENT_SCHEMA_VERSION}`,
      )
    }

    return migrated
  }

  /**
   * Migrate a serialized JSON string.
   */
  static migrateJSON(json: string): string {
    const data = JSON.parse(json)
    const migrated = GraphMigration.migrate(data)
    return JSON.stringify(migrated)
  }

  /**
   * Register a custom migration step.
   * Useful for external plugins.
   */
  static registerStep(step: MigrationStep): void {
    MIGRATIONS.push(step)
  }
}
