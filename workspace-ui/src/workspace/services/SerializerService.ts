/**
 * SerializerService — workspace-level serialization
 *
 * Extends the existing LayoutSerializer with:
 *   - Full workspace export (all layouts + metadata)
 *   - Version migration with per-version transforms
 *   - Clipboard and download helpers
 *
 * The LayoutSerializer handles single-layout import/export.
 * This service adds workspace-level packaging and migration.
 *
 * @since 3.2.4
 */

import type { WorkspacePersistenceState, WorkspaceLayout } from '../layout/types'
import { PERSISTENCE_VERSION } from '../layout/types'
import { exportLayout, importLayout, deserializeState } from '../layout/LayoutSerializer'
import { cloneWorkspaceLayout } from '../layout/WorkspaceLayout'

export const WORKSPACE_FORMAT_VERSION = 1

export interface WorkspaceExport {
  formatVersion: number
  exportedAt: number
  application: string
  state: WorkspacePersistenceState
}

/** Migration transforms keyed by source version */
const MIGRATIONS: Record<number, (state: WorkspacePersistenceState) => WorkspacePersistenceState> = {
  // Version 0 → 1: ensure theme and sidebarPinned fields exist
  0: (state) => ({
    ...state,
    theme: state.theme || 'dark',
    sidebarPinned: state.sidebarPinned ?? true,
    version: 1,
  }),
}

export class SerializerService {
  /**
   * Export full workspace state as a JSON string.
   * Includes all layouts, active layout, theme, and format metadata.
   */
  exportWorkspace(state: WorkspacePersistenceState): string {
    const payload: WorkspaceExport = {
      formatVersion: WORKSPACE_FORMAT_VERSION,
      exportedAt: Date.now(),
      application: 'trading-workspace',
      state,
    }
    return JSON.stringify(payload, null, 2)
  }

  /**
   * Import workspace state from a JSON string.
   * Supports both:
   *   - Full WorkspaceExport format (with formatVersion)
   *   - Raw WorkspacePersistenceState (backward compat)
   *
   * Applies version migrations if needed.
   * Returns null on parse failure or invalid format.
   */
  importWorkspace(raw: string): WorkspacePersistenceState | null {
    try {
      const parsed = JSON.parse(raw)

      // Full export format
      if (parsed && typeof parsed === 'object' && parsed.formatVersion !== undefined) {
        const exportData = parsed as WorkspaceExport
        if (!exportData.state || typeof exportData.state !== 'object') return null
        if (!exportData.state.layouts || typeof exportData.state.layouts !== 'object') return null
        return this.migrate(exportData.state)
      }

      // Raw persistence state (backward compat)
      const state = deserializeState(raw)
      if (!state) return null
      return this.migrate(state)
    } catch {
      return null
    }
  }

  /**
   * Apply migrations to bring a persisted state up to the current version.
   * Runs each skipped version's migrator in sequence.
   */
  migrate(state: WorkspacePersistenceState): WorkspacePersistenceState {
    let current = { ...state }
    // Deep-clone layouts to avoid mutating the original
    current.layouts = Object.fromEntries(
      Object.entries(current.layouts).map(([id, l]) => [id, cloneWorkspaceLayout(l)]),
    )

    while (current.version < PERSISTENCE_VERSION) {
      const migrator = MIGRATIONS[current.version]
      if (!migrator) {
        // No migrator found — jump to current version to avoid infinite loop
        current.version = PERSISTENCE_VERSION
        break
      }
      current = migrator(current)
    }
    return current
  }

  /**
   * Export a single layout as a JSON string (for sharing).
   * Delegates to LayoutSerializer.exportLayout.
   */
  exportSingleLayout(layout: WorkspaceLayout): string {
    return exportLayout(cloneWorkspaceLayout(layout))
  }

  /**
   * Import a single layout from a JSON string.
   * Delegates to LayoutSerializer.importLayout.
   */
  importSingleLayout(raw: string): WorkspaceLayout | null {
    return importLayout(raw)
  }

  /**
   * Trigger a file download of the given JSON content.
   */
  downloadAsFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
