/**
 * LayoutSerializer — persist/restore workspace state to localStorage
 *
 * Handles:
 * - Save/load workspace state
 * - Individual layout import/export
 * - Version migration
 *
 * @since 3.2.0
 */

import type { WorkspaceLayout, WorkspacePersistenceState, LayoutId } from './types'
import { PERSISTENCE_VERSION } from './types'

const STORAGE_KEY = 'workspace-ui:layouts'

// ── Serialization ──

export function serializeState(state: WorkspacePersistenceState): string {
  return JSON.stringify(state, null, 2)
}

export function deserializeState(raw: string): WorkspacePersistenceState | null {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.layouts || !parsed.activeLayout) return null
    return parsed as WorkspacePersistenceState
  } catch {
    return null
  }
}

// ── localStorage ──

export function persistState(state: WorkspacePersistenceState): void {
  try {
    const raw = serializeState(state)
    localStorage.setItem(STORAGE_KEY, raw)
  } catch (err) {
    console.error('[LayoutSerializer] Failed to persist workspace state', err)
  }
}

export function loadPersistedState(): WorkspacePersistenceState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return deserializeState(raw)
  } catch {
    return null
  }
}

// ── Export / Import ──

export function exportLayout(layout: WorkspaceLayout): string {
  return JSON.stringify(layout, null, 2)
}

export function importLayout(raw: string): WorkspaceLayout | null {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.id || !parsed.name || !Array.isArray(parsed.panels)) return null
    return parsed as WorkspaceLayout
  } catch {
    return null
  }
}

// ── Build default persistence state ──

export function createDefaultPersistenceState(
  layouts: Record<LayoutId, WorkspaceLayout>,
  activeLayout?: LayoutId,
): WorkspacePersistenceState {
  const ids = Object.keys(layouts)
  return {
    layouts,
    activeLayout: activeLayout || ids[0] || 'default',
    theme: 'dark',
    sidebarPinned: true,
    version: PERSISTENCE_VERSION,
  }
}
