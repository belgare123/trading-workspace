/**
 * WorkspaceSerializer.ts — Serialize/deserialize full workspace sessions
 *
 * Handles:
 * - Export full workspace as JSON
 * - Import from JSON
 * - Per-entity serialization hooks (chart, strategy, builder)
 * - Version-gated deserialization
 *
 * @since 3.7.1
 */

import type { WorkspaceSession, SessionId } from './WorkspaceSession'
import { WORKSPACE_SESSION_VERSION } from './WorkspaceSession'
import { workspaceMigration } from './WorkspaceMigration'

// ── Serialization options ──

export interface SerializeOptions {
  pretty?: boolean
  stripData?: boolean // Remove candle/bar data but keep state
  compress?: boolean  // Future: enable compression for large sessions
}

// ── Serializer ──

export class WorkspaceSerializer {
  /**
   * Serialize a full workspace session to JSON string.
   */
  serialize(session: WorkspaceSession, options: SerializeOptions = {}): string {
    const cloned = this.prepareForExport(session, options)
    return options.pretty
      ? JSON.stringify(cloned, null, 2)
      : JSON.stringify(cloned)
  }

  /**
   * Deserialize a workspace session from JSON string.
   * Applies version migration if needed.
   */
  deserialize(raw: string): WorkspaceSession | null {
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return null

      // Validate required fields
      if (!parsed.id || !parsed.name || !parsed.layout) return null

      // Apply version migration
      const currentVersion = parsed.version ?? 0
      if (currentVersion < WORKSPACE_SESSION_VERSION) {
        const migrated = workspaceMigration.migrate(parsed, currentVersion, WORKSPACE_SESSION_VERSION)
        if (!migrated) return null
        migrated.version = WORKSPACE_SESSION_VERSION
        return this.validate(migrated) ? migrated : null
      }

      return this.validate(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  /**
   * Create a minimal session snapshot for auto-save.
   * Strips non-essential data to keep auto-saves small.
   */
  createAutoSaveSnapshot(session: WorkspaceSession): string {
    const snapshot = this.prepareForExport(session, { stripData: true })
    return JSON.stringify(snapshot)
  }

  /**
   * Deep clone a session (for undo/checkpoint).
   */
  clone(session: WorkspaceSession): WorkspaceSession {
    return JSON.parse(JSON.stringify(session))
  }

  // ── Private ──

  private prepareForExport(session: WorkspaceSession, options: SerializeOptions): WorkspaceSession {
    const clone = this.clone(session)
    clone.version = WORKSPACE_SESSION_VERSION
    clone.updatedAt = Date.now()

    if (options.stripData) {
      // Strip data-heavy fields — keep only metadata and structure
      // (implemented by consumers that add data to sessions)
    }

    return clone
  }

  private validate(session: WorkspaceSession): boolean {
    if (!session.id || typeof session.id !== 'string') return false
    if (!session.name || typeof session.name !== 'string') return false
    if (typeof session.version !== 'number') return false
    if (!session.layout || typeof session.layout !== 'object') return false
    return true
  }
}

// ── Singleton ──

export const workspaceSerializer = new WorkspaceSerializer()

// ── Create blank session ──

export function createBlankSession(
  layout: WorkspaceSession['layout'],
  id?: SessionId,
  name?: string,
): WorkspaceSession {
  const now = Date.now()
  return {
    id: id ?? crypto.randomUUID?.() ?? `session-${now}`,
    name: name ?? 'Untitled Workspace',
    version: WORKSPACE_SESSION_VERSION,
    createdAt: now,
    updatedAt: now,
    layout,
  }
}
