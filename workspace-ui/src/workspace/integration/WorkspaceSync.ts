/**
 * WorkspaceSync.ts — Workspace session synchronization
 *
 * Coordinates workspace state across all modules.
 * WorkspaceSession acts as coordinator — references only,
 * no business state duplication.
 *
 * All frozen Runtime's maintain their own state internally.
 * This layer only captures/persists/restores layout + panel metadata.
 *
 * @since 3.7.2
 */

import type { WorkspaceSession } from './WorkspaceSession'
import { WORKSPACE_SESSION_VERSION } from './WorkspaceSession'
import { workspaceSerializer, createBlankSession } from './WorkspaceSerializer'
import { layoutEngine } from '../layout/LayoutEngine'
import { persistState } from '../layout/LayoutSerializer'
import type { WorkspacePersistenceState } from '../layout/types'

// ═══════════════════════════════════════════
// Sync event types
// ═══════════════════════════════════════════

export interface SyncEvent {
  type: 'session-persist' | 'session-restore' | 'session-export' | 'panel-opened' | 'panel-closed' | 'layout-changed'
  timestamp: number
  detail?: string
}

export type SyncListener = (event: SyncEvent) => void

// ═══════════════════════════════════════════
// Helpers
// ── Helpers ──

const STORAGE_KEY = 'hermes-workspace-session'

function currentLayoutState(): WorkspacePersistenceState {
  return {
    ...layoutEngine.state,
    layouts: { ...layoutEngine.state.layouts },
  }
}

// ═══════════════════════════════════════════
// WorkspaceSync — singleton coordinator
// ═══════════════════════════════════════════

export class WorkspaceSync {
  private readonly listeners: Set<SyncListener> = new Set()
  private _autoSave = false
  private _saveTimer: ReturnType<typeof setTimeout> | null = null
  private _dirty = false

  // ── Events ──

  on(listener: SyncListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(type: SyncEvent['type'], detail?: string): void {
    const event: SyncEvent = { type, timestamp: Date.now(), detail }
    this.listeners.forEach(l => l(event))
  }

  // ── Auto-save ──

  get autoSave(): boolean { return this._autoSave }

  enableAutoSave(): void {
    this._autoSave = true
    this.markDirty()
  }

  disableAutoSave(): void {
    this._autoSave = false
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = null
    }
  }

  markDirty(): void {
    if (!this._autoSave) return
    this._dirty = true
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => this.flush(), 1000)
  }

  flush(): void {
    if (!this._dirty) return
    this._dirty = false
    if (this._saveTimer) {
      clearTimeout(this._saveTimer)
      this._saveTimer = null
    }
    const session = this.capture()
    this.saveToLocal(session)
    this.emit('session-persist')
  }

  // ── Capture ──

  capture(): WorkspaceSession {
    return createBlankSession(currentLayoutState())
  }

  // ── Restore ──

  restore(session: WorkspaceSession): void {
    if (session.version !== WORKSPACE_SESSION_VERSION) {
      throw new Error(
        `Version mismatch: expected ${WORKSPACE_SESSION_VERSION}, got ${session.version}`,
      )
    }
    // Persist layout to localStorage so LayoutEngine picks it up on next init
    persistState(session.layout)
    this.emit('session-restore')
  }

  // ── Export / Import ──

  exportSession(): string {
    const session = this.capture()
    const json = workspaceSerializer.serialize(session)
    this.emit('session-export')
    return json
  }

  importSession(json: string): boolean {
    const session = workspaceSerializer.deserialize(json)
    if (!session) return false
    this.restore(session)
    return true
  }

  // ── Local storage ──

  private saveToLocal(session: WorkspaceSession): void {
    try {
      const json = workspaceSerializer.serialize(session)
      localStorage.setItem(STORAGE_KEY, json)
    } catch {
      // localStorage unavailable or full
    }
  }

  restoreLastSession(): boolean {
    try {
      const json = localStorage.getItem(STORAGE_KEY)
      if (!json) return false
      const session = workspaceSerializer.deserialize(json)
      if (!session) return false
      this.restore(session)
      return true
    } catch {
      return false
    }
  }
}

/** Singleton instance */
export const workspaceSync = new WorkspaceSync()
