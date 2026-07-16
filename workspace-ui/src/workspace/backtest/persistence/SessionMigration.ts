// ── SessionMigration — Version migration for persistent sessions ──
//
// Stub for future schema migration support.
//
// @since 3.5.3

import type { ReportSnapshotData } from '../report/ReportSnapshot'

const CURRENT_VERSION = '3.5.3'

export class SessionMigration {
  /** Available migration functions keyed by target version */
  private migrations: Record<string, (data: unknown) => unknown> = {}

  /** Register a migration from version -> next */
  register(from: string, fn: (data: unknown) => unknown): void {
    this.migrations[from] = fn
  }

  /** Check if a snapshot needs migration */
  needsMigration(data: ReportSnapshotData): boolean {
    return data.version !== CURRENT_VERSION
  }

  /** Migrate data to the latest version */
  migrate(data: ReportSnapshotData): ReportSnapshotData {
    let current = data as unknown

    // Chain through migrations
    while (this.needsMigration(current as ReportSnapshotData)) {
      const version = (current as ReportSnapshotData).version
      const migration = this.migrations[version]
      if (!migration) {
        throw new Error(`No migration path from version ${version}`)
      }
      current = migration(current)
    }

    return current as ReportSnapshotData
  }
}
