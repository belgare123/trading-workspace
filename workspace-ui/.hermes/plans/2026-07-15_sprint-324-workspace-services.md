# Sprint 3.2.4 — Workspace Services Implementation Plan

> **Goal:** Complete the platform infrastructure layer with three services: Undo/Redo Manager, Command Registry, and Workspace Serialization. After this sprint, the Platform Core can be declared Frozen v1.0.

## Architecture Principles

- **No changes to frozen contracts** — Layout Engine API, Panel Runtime, Dock Manager remain unchanged.
- **New capabilities as services** — UndoManager, CommandRegistry, SerializerService are standalone classes consumed by existing components.
- **Platform Change Rule** — if a feature cannot be implemented as a service, it doesn't belong in 3.2.4.

## Current state

```
LayoutEngine ───── save() ─────► LayoutSerializer (localStorage)
     │
     ▼
DockController ─── history.record() ───► OperationHistory (undo/redo infra)
     │
PanelActions ─── key hints, but no global Command Registry
```

**Missing:**
1. UndoManager that actually calls `engine.applySnapshot()` / `engine.restoreSnapshot()`
2. CommandRegistry with keyboard shortcuts
3. SerializerService for import/export/workspace snapshots

---

## Task 1: WorkspaceLayout — apply/restore snapshot methods

**Objective:** Add methods to LayoutEngine for atomic layout replacement (needed by Undo/Redo).

**Files:**
- Modify: `src/workspace/layout/LayoutEngine.ts` (lines 126-168 area)

**Changes:**

```typescript
// Add to LayoutEngine class:

/** Replace entire layout with a snapshot (for undo/redo). Bypasses save(). */
applySnapshot(layout: WorkspaceLayout): void {
  this._current = cloneWorkspaceLayout(layout)
  this._state.layouts[layout.id] = cloneWorkspaceLayout(layout)
  this.notify()
}

/** Restore a previously saved snapshot */
restoreSnapshot(snapshot: WorkspaceLayout): void {
  this.applySnapshot(snapshot)
  this.save()
}
```

**Verification:**
- `engine.applySnapshot(layout)` updates `engine.current` and notifies subscribers.
- `engine.restoreSnapshot(layout)` does the same + persists to localStorage.

---

## Task 2: UndoManager — connect OperationHistory to LayoutEngine

**Objective:** Wire `OperationHistory` (undo pointer) to actual `engine.restoreSnapshot()` calls.

**Files:**
- Create: `src/workspace/services/UndoManager.ts`
- Create: `src/workspace/services/index.ts`

**Implementation:**

```typescript
/**
 * UndoManager — connects OperationHistory to LayoutEngine
 *
 * Uses before/after snapshots from OperationHistory to implement
 * undo and redo via full-layout replacement.
 *
 * @since 3.2.4
 */

import { OperationHistory } from '../docking/OperationHistory'
import type { LayoutEngine } from '../layout/LayoutEngine'
import { cloneWorkspaceLayout } from '../layout/WorkspaceLayout'

export interface UndoManagerOptions {
  maxHistory?: number
}

export class UndoManager {
  private history: OperationHistory
  private engine: LayoutEngine

  constructor(engine: LayoutEngine, opts?: UndoManagerOptions) {
    this.engine = engine
    this.history = new OperationHistory({ maxSize: opts?.maxHistory ?? 200 })
  }

  /** Get underlying history (for DockController to record into) */
  get operationHistory(): OperationHistory {
    return this.history
  }

  /** Undo the last operation — restores the 'before' snapshot */
  undo(): boolean {
    const op = this.history.undoOp
    if (!op) return false
    // Restore 'before' snapshot (which creates a new 'after' state)
    this.engine.applySnapshot({
      ...cloneWorkspaceLayout(this.engine.current),
      panels: op.before,
    })
    this.history.didUndo()
    return true
  }

  /** Redo the last undone operation — restores the 'after' snapshot */
  redo(): boolean {
    const op = this.history.redoOp
    if (!op) return false
    this.engine.applySnapshot({
      ...cloneWorkspaceLayout(this.engine.current),
      panels: op.after,
    })
    this.history.didRedo()
    return true
  }

  /** Whether undo is available */
  get canUndo(): boolean {
    return this.history.canUndo
  }

  /** Whether redo is available */
  get canRedo(): boolean {
    return this.history.canRedo
  }

  /** Description of the next undo operation (for UI tooltips) */
  get undoDescription(): string | undefined {
    return this.history.undoOp?.description
  }

  /** Description of the next redo operation */
  get redoDescription(): string | undefined {
    return this.history.redoOp?.description
  }

  /** Clear history */
  clear(): void {
    this.history.clear()
  }
}
```

**Integration point:** DockController currently has `this.history = new OperationHistory()` — create UndoManager instead and expose `history` via it. No API change needed for DockController's internal usage.

Actually — better approach: keep DockController using its own `OperationHistory` for recording, and let UndoManager be a standalone service that wraps `OperationHistory` for undo/redo. The UndoManager can accept a reference to DockController's history, or DockController can expose it.

**Simpler approach:** DockController's `history` is already public. UndoManager takes a reference to it:

```typescript
constructor(engine: LayoutEngine, history: OperationHistory)
```

**Verification:**
- `undoManager.undo()` restores panels to before-state
- `undoManager.redo()` restores panels to after-state
- `canUndo` / `canRedo` reflect correct state after multiple operations

---

## Task 3: CommandRegistry — central command definitions with shortcuts

**Objective:** Create a registry of all workspace commands (close, split, float, undo, redo, etc.) with keyboard shortcuts, categories, and `canExecute()` guards.

**Files:**
- Create: `src/workspace/services/CommandRegistry.ts`
- Modify: `src/workspace/services/index.ts`

**Implementation:**

```typescript
/**
 * CommandRegistry — central registry of workspace commands
 *
 * Each command has:
 *   id        — unique identifier
 *   title     — human-readable label
 *   category  — grouping (e.g. 'panel', 'workspace', 'edit')
 *   shortcut  — optional KeyboardEvent-compatible shortcut (e.g. 'Ctrl+Z')
 *   execute   — action handler
 *   canExecute — optional guard (returns false when command is unavailable)
 *
 * @since 3.2.4
 */

export interface Command {
  id: string
  title: string
  category: string
  shortcut?: string
  /** Optional icon character */
  icon?: string
  /** Execute the command */
  execute: () => void
  /** Guard — return false to disable the command */
  canExecute?: () => boolean
}

export class CommandRegistry {
  private commands = new Map<string, Command>()
  private shortcutMap = new Map<string, string>() // shortcut → commandId

  /** Register a command */
  register(command: Command): void {
    this.commands.set(command.id, command)
    if (command.shortcut) {
      this.shortcutMap.set(this.normalizeShortcut(command.shortcut), command.id)
    }
  }

  /** Register multiple commands */
  registerAll(commands: Command[]): void {
    for (const cmd of commands) this.register(cmd)
  }

  /** Get command by id */
  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  /** Get all commands (optionally filtered by category) */
  getAll(category?: string): Command[] {
    const all = Array.from(this.commands.values())
    if (!category) return all
    return all.filter(c => c.category === category)
  }

  /** Find a command by keyboard event */
  matchShortcut(event: { ctrlKey: boolean; metaKey: boolean; key: string }): Command | undefined {
    const parts: string[] = []
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
    // Shift, Alt could be added here
    parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key)
    const key = parts.join('+')
    const id = this.shortcutMap.get(key)
    return id ? this.commands.get(id) : undefined
  }

  /** Execute command if registered and canExecute passes */
  execute(id: string): boolean {
    const cmd = this.commands.get(id)
    if (!cmd) return false
    if (cmd.canExecute && !cmd.canExecute()) return false
    cmd.execute()
    return true
  }

  /** Check if a command can be executed */
  canExecute(id: string): boolean {
    const cmd = this.commands.get(id)
    if (!cmd) return false
    return cmd.canExecute ? cmd.canExecute() : true
  }

  private normalizeShortcut(shortcut: string): string {
    return shortcut
      .split('+')
      .map(s => s.trim())
      .join('+')
  }
}

/** Build standard workspace commands */
export function createWorkspaceCommands(
  undoManager: UndoManager,
  layoutEngine: LayoutEngine,
): Command[] {
  return [
    {
      id: 'workspace.undo',
      title: 'Undo',
      category: 'edit',
      shortcut: 'Ctrl+Z',
      icon: '↩',
      execute: () => undoManager.undo(),
      canExecute: () => undoManager.canUndo,
    },
    {
      id: 'workspace.redo',
      title: 'Redo',
      category: 'edit',
      shortcut: 'Ctrl+Y',
      icon: '↪',
      execute: () => undoManager.redo(),
      canExecute: () => undoManager.canRedo,
    },
    {
      id: 'panel.close',
      title: 'Close Panel',
      category: 'panel',
      shortcut: 'Ctrl+W',
      icon: '×',
      execute: () => { /* called per active panel — see below */ },
    },
    {
      id: 'panel.split',
      title: 'Split Panel',
      category: 'panel',
      shortcut: 'Ctrl+\\',
      icon: '⊞',
      execute: () => { /* called per active panel */ },
    },
    {
      id: 'workspace.save',
      title: 'Save Workspace',
      category: 'workspace',
      shortcut: 'Ctrl+S',
      icon: '💾',
      execute: () => { layoutEngine.save() },
    },
    {
      id: 'workspace.reset',
      title: 'Reset to Default',
      category: 'workspace',
      icon: '↺',
      execute: () => { layoutEngine.resetToDefault() },
    },
    {
      id: 'workspace.export',
      title: 'Export Layout',
      category: 'workspace',
      shortcut: 'Ctrl+E',
      icon: '📤',
      execute: () => {
        const json = layoutEngine.exportCurrent()
        navigator.clipboard?.writeText(json)
      },
    },
    {
      id: 'workspace.import',
      title: 'Import Layout',
      category: 'workspace',
      icon: '📥',
      execute: () => { /* open import dialog */ },
    },
  ]
}
```

**Verification:**
- `registry.getAll('edit')` returns undo + redo
- `registry.matchShortcut({ ctrlKey: true, key: 'z' })` returns undo command
- `registry.canExecute('workspace.undo')` returns false when history is empty

---

## Task 4: KeyboardBinding — global keyboard shortcut handler

**Objective:** A simple React hook that listens for keyboard events and delegates to CommandRegistry.

**Files:**
- Create: `src/workspace/services/KeyboardBinding.ts`

**Implementation:**

```typescript
/**
 * KeyboardBinding — React hook for global keyboard shortcuts
 *
 * Attaches a keydown listener to the window and dispatches
 * matching commands from CommandRegistry.
 *
 * @since 3.2.4
 */

import { useEffect } from 'react'
import type { CommandRegistry } from './CommandRegistry'

export function useKeyboardBinding(registry: CommandRegistry): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Don't intercept when focus is inside input/textarea
      const tag = (event.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const cmd = registry.matchShortcut({
        ctrlKey: event.ctrlKey || event.metaKey,
        metaKey: event.metaKey,
        key: event.key,
      })

      if (cmd && cmd.canExecute ? cmd.canExecute() : true) {
        event.preventDefault()
        event.stopPropagation()
        cmd.execute()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [registry])
}
```

**Verification:**
- Pressing Ctrl+Z calls `undoManager.undo()`
- Pressing Ctrl+W calls `panel.close`
- Input-focused elements are not intercepted

---

## Task 5: SerializerService — enhanced workspace import/export

**Objective:** Build on existing `LayoutSerializer` to add workspace-level export/import (multiple layouts, metadata, version migration).

**Files:**
- Create: `src/workspace/services/SerializerService.ts`
- Modify: `src/workspace/services/index.ts`

**Implementation:**

```typescript
/**
 * SerializerService — workspace-level serialization
 *
 * Extends LayoutSerializer with:
 *   - Full workspace export (all layouts + metadata)
 *   - Version migration with per-version transforms
 *   - Clipboard operations
 *   - File download/upload helpers
 *
 * @since 3.2.4
 */

import { exportLayout, importLayout, serializeState, deserializeState } from '../layout/LayoutSerializer'
import type { WorkspacePersistenceState, WorkspaceLayout } from '../layout/types'
import { LAYOUT_VERSION, PERSISTENCE_VERSION } from '../layout/types'
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
  // Version 0 → 1: add theme field if missing
  0: (state) => ({
    ...state,
    theme: state.theme || 'dark',
    sidebarPinned: state.sidebarPinned ?? true,
    version: 1,
  }),
}

export class SerializerService {
  /**
   * Export full workspace state as JSON string.
   * Includes all layouts, metadata, and format version.
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
   * Import workspace state from JSON string.
   * Applies version migrations if needed.
   * Returns null on parse failure or invalid format.
   */
  importWorkspace(raw: string): WorkspacePersistenceState | null {
    try {
      const parsed = JSON.parse(raw)

      // Support both full export and raw persistence state
      if (parsed.formatVersion !== undefined) {
        // Full export format
        const exportData = parsed as WorkspaceExport
        if (!exportData.state || typeof exportData.state !== 'object') return null
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
   * Apply migrations to bring state up to current version.
   */
  migrate(state: WorkspacePersistenceState): WorkspacePersistenceState {
    let current = { ...state }
    // Run migrations sequentially from current version up to target
    while (current.version < PERSISTENCE_VERSION) {
      const migrator = MIGRATIONS[current.version]
      if (!migrator) {
        // No migrator found — jump to current version
        current.version = PERSISTENCE_VERSION
        break
      }
      current = migrator(current)
    }
    return current
  }

  /**
   * Export a single layout as JSON (for sharing individual layouts).
   */
  exportLayout(layout: WorkspaceLayout): string {
    return exportLayout(cloneWorkspaceLayout(layout))
  }

  /**
   * Import a single layout from JSON.
   */
  importLayout(raw: string): WorkspaceLayout | null {
    return importLayout(raw)
  }

  /**
   * Download JSON as a file.
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
```

**Verification:**
- `exportWorkspace(state)` produces valid JSON with formatVersion
- `importWorkspace(validJson)` returns a valid `WorkspacePersistenceState`
- `importWorkspace('invalid')` returns `null`
- Migration from version 0 fills in defaults

---

## Task 6: Services barrel + WorkspaceServices integration

**Objective:** Export all services from a single barrel, add a `WorkspaceServices` container class.

**Files:**
- Modify: `src/workspace/services/index.ts`
- Modify: `src/workspace/index.ts` (add re-exports)

**Implementation:**

```typescript
// src/workspace/services/index.ts

export { UndoManager } from './UndoManager'
export type { UndoManagerOptions } from './UndoManager'

export { CommandRegistry, createWorkspaceCommands } from './CommandRegistry'
export type { Command } from './CommandRegistry'

export { useKeyboardBinding } from './KeyboardBinding'

export { SerializerService } from './SerializerService'
export type { WorkspaceExport } from './SerializerService'
export { WORKSPACE_FORMAT_VERSION } from './SerializerService'

/**
 * WorkspaceServices — container for all workspace-level services.
 * Single point of construction, simplifies integration.
 */
import { LayoutEngine } from '../layout/LayoutEngine'
import { OperationHistory } from '../docking/OperationHistory'
import { UndoManager } from './UndoManager'
import { CommandRegistry, createWorkspaceCommands } from './CommandRegistry'
import { SerializerService } from './SerializerService'

export class WorkspaceServices {
  readonly engine: LayoutEngine
  readonly undoManager: UndoManager
  readonly commandRegistry: CommandRegistry
  readonly serializer: SerializerService
  /** Reference to DockController's OperationHistory for recording */
  readonly operationHistory: OperationHistory

  constructor(engine: LayoutEngine, operationHistory?: OperationHistory) {
    this.engine = engine
    this.serializer = new SerializerService()
    this.operationHistory = operationHistory ?? new OperationHistory()
    this.undoManager = new UndoManager(engine, this.operationHistory)
    this.commandRegistry = new CommandRegistry()

    // Register default commands
    this.commandRegistry.registerAll(
      createWorkspaceCommands(this.undoManager, engine)
    )
  }
}
```

**Barrel update in `src/workspace/index.ts`:**

```typescript
// Add to re-exports
export { UndoManager, CommandRegistry, SerializerService, WorkspaceServices } from './services'
export { useKeyboardBinding } from './services'
export type { Command } from './services'
```

---

## Task 7: Integration — wire services into App

**Objective:** Instantiate `WorkspaceServices` in the app and provide them via context/import.

**Files:**
- Modify: `src/App.tsx` or equivalent bootstrap file

The exact integration depends on how the app is structured. The principle:

```typescript
// At app bootstrap (e.g., PlatformBootstrap or App.tsx):
import { layoutEngine } from './workspace/layout/LayoutEngine'
import { WorkspaceServices } from './workspace/services'
import { DockController } from './workspace/docking/DockController'

const services = new WorkspaceServices(layoutEngine)

// DockController records into the same OperationHistory
const dockController = new DockController({
  engine: layoutEngine,
  eventBus,
})
// Now services.undoManager.operationHistory === dockController.history
// Or simply: dockController.history is used directly

// Global keyboard shortcuts
function AppRoot() {
  useKeyboardBinding(services.commandRegistry)
  // ...
}
```

---

## Risk assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `applySnapshot` bypasses validation | Medium | Already validated at command time; snapshot just restores known-good state |
| Undo/redo with large panel count (300+) | Low | Memory from full snapshots; acceptable for current scale |
| Shortcut conflicts with browser defaults | Low | Shortcuts are opt-in; user can reconfigure via CommandRegistry |
| DockController history ≠ UndoManager history | Medium | Both reference the same `OperationHistory` instance through `WorkspaceServices` |

---

## Verification checklist

- [ ] `LayoutEngine.applySnapshot(layout)` — sub updates, notify fires
- [ ] `UndoManager.undo()` — restores before-panels, `canUndo` reflects correctly
- [ ] `UndoManager.redo()` — restores after-panels, `canRedo` reflects correctly
- [ ] `CommandRegistry.matchShortcut({ ctrlKey: true, key: 'z' })` → undo command
- [ ] `useKeyboardBinding` — Ctrl+Z triggers undo, input fields excluded
- [ ] `SerializerService.exportWorkspace` → valid JSON with formatVersion
- [ ] `SerializerService.importWorkspace(exported)` → fully restored state
- [ ] `SerializerService.importWorkspace('invalid')` → null
- [ ] Version migration: version 0 → 1 fills defaults
- [ ] Full `vite build` — 0 errors
- [ ] 0 changes to Layout Engine API, Panel Runtime, Dock Manager frozen contracts
