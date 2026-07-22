// src/event-journal/SchemaManager.ts
// Versioned DDL, PRAGMA configuration, and schema migrations for SQLiteEventJournal

import type Database from 'better-sqlite3'

const SCHEMA_VERSION_KEY = 'schema_version'
const CURRENT_SCHEMA_VERSION = 2

/** DDL statements grouped by version */
const SCHEMAS: Record<number, string[]> = {
  1: [
    // ── Events table ──
    `CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id    TEXT    UNIQUE NOT NULL,
      trace_id    TEXT,
      causation_id TEXT,
      runtime_id  TEXT    NOT NULL,
      event_type  TEXT    NOT NULL,
      aggregate_type TEXT,
      aggregate_id  TEXT,
      sequence    INTEGER NOT NULL,
      timestamp   INTEGER NOT NULL,
      critical    INTEGER DEFAULT 0,
      payload     BLOB,
      metadata    BLOB
    )`,
    // ── Snapshots table (v1) ──
    `CREATE TABLE IF NOT EXISTS snapshots (
      snapshot_id  TEXT PRIMARY KEY,
      aggregate_id TEXT NOT NULL,
      sequence     INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      payload      BLOB
    )`,
    // ── Meta table ──
    `CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    // ── Indexes ──
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_events_event_id    ON events(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_trace_id           ON events(trace_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_aggregate          ON events(aggregate_type, aggregate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_timestamp          ON events(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_events_runtime            ON events(runtime_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_event_type         ON events(event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_events_sequence           ON events(sequence)`,
    `CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate       ON snapshots(aggregate_id)`,
  ],
  2: [
    // snapshots v2 — add versioned columns via migration below
  ],
}

const MIGRATIONS: Record<number, string[]> = {
  2: [
    `ALTER TABLE snapshots ADD COLUMN snapshot_version INTEGER DEFAULT 1`,
    `ALTER TABLE snapshots ADD COLUMN checksum TEXT`,
    `ALTER TABLE snapshots ADD COLUMN last_applied_sequence INTEGER`,
    `CREATE INDEX IF NOT EXISTS idx_snapshots_last_applied ON snapshots(last_applied_sequence)`,
  ],
}

export class SchemaManager {
  private db: Database.Database
  private version = 0

  constructor(db: Database.Database) {
    this.db = db
  }

  get currentVersion(): number {
    return this.version
  }

  /** Apply PRAGMA settings for optimal journal performance */
  applyPragmas(): void {
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('busy_timeout = 5000')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('cache_size = -64000') // 64 MB cache
  }

  /** Initialize or migrate the schema to the latest version */
  migrate(): void {
    this.version = this.readSchemaVersion()

    if (this.version === 0) {
      // Fresh database — apply all schemas
      this.applyPragmas()
      this.applySchemaUpTo(CURRENT_SCHEMA_VERSION)
      this.writeSchemaVersion(CURRENT_SCHEMA_VERSION)
      this.version = CURRENT_SCHEMA_VERSION
      return
    }

    if (this.version < CURRENT_SCHEMA_VERSION) {
      // Apply incremental migrations
      for (let v = this.version + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
        const ddl = SCHEMAS[v]
        if (ddl) {
          this.db.transaction(() => {
            for (const stmt of ddl) {
              this.db.exec(stmt)
            }
          })()
        }
        const migration = MIGRATIONS[v]
        if (migration) {
          this.db.transaction(() => {
            for (const stmt of migration) {
              this.db.exec(stmt)
            }
          })()
        }
        this.writeSchemaVersion(v)
      }
      this.version = CURRENT_SCHEMA_VERSION
    }
  }

  /** Wipe all data (for testing) */
  reset(): void {
    this.db.exec('DROP TABLE IF EXISTS events')
    this.db.exec('DROP TABLE IF EXISTS snapshots')
    this.db.exec('DROP TABLE IF EXISTS meta')
    this.version = 0
  }

  // ─── private ───

  private applySchemaUpTo(version: number): void {
    for (let v = 1; v <= version; v++) {
      const ddl = SCHEMAS[v]
      if (ddl) {
        for (const stmt of ddl) {
          this.db.exec(stmt)
        }
      }
      const migration = MIGRATIONS[v]
      if (migration) {
        for (const stmt of migration) {
          this.db.exec(stmt)
        }
      }
    }
  }

  private readSchemaVersion(): number {
    try {
      const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(SCHEMA_VERSION_KEY) as { value: string } | undefined
      return row ? parseInt(row.value, 10) : 0
    } catch {
      return 0
    }
  }

  private writeSchemaVersion(version: number): void {
    this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(SCHEMA_VERSION_KEY, String(version))
  }

  /** Export all DDL statements for inspection */
  static getDDL(version: number = CURRENT_SCHEMA_VERSION): string[] {
    const result: string[] = []
    for (let v = 1; v <= version; v++) {
      const ddl = SCHEMAS[v]
      if (ddl) result.push(...ddl)
    }
    return result
  }
}
