/**
 * createWorkspaceCommands — factory for standard workspace commands
 *
 * Creates the set of built-in commands that depend on UndoManager
 * and LayoutEngine. Keeps CommandRegistry free of service dependencies.
 *
 * @since 3.2.4
 */

import type { UndoManager } from './UndoManager'
import type { LayoutEngine } from '../layout/LayoutEngine'
import type { Command } from './CommandRegistry'

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
      execute: () => { undoManager.undo() },
      canExecute: () => undoManager.canUndo,
    },
    {
      id: 'workspace.redo',
      title: 'Redo',
      category: 'edit',
      shortcut: 'Ctrl+Y',
      icon: '↪',
      execute: () => { undoManager.redo() },
      canExecute: () => undoManager.canRedo,
    },
    {
      id: 'panel.close',
      title: 'Close Panel',
      category: 'panel',
      shortcut: 'Ctrl+W',
      icon: '×',
      execute: () => {
        // Active panel close is handled by the focused panel's toolbar.
        // This command is a placeholder for keyboard shortcut routing —
        // DockController or PanelRuntime registers the real handler.
        console.warn('[CommandRegistry] panel.close: no active panel')
      },
    },
    {
      id: 'panel.split',
      title: 'Split Panel',
      category: 'panel',
      shortcut: 'Ctrl+\\',
      icon: '⊞',
      execute: () => {
        console.warn('[CommandRegistry] panel.split: no active panel')
      },
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
      shortcut: 'Ctrl+Shift+E',
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
      execute: () => {
        // Import triggers a file picker or paste handler
        console.warn('[CommandRegistry] workspace.import: not implemented')
      },
    },
  ]
}
