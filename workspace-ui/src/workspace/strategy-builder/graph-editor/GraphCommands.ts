// ── GraphCommands — CommandRegistry integration ──
//
// Registers graph editing commands in the platform's CommandRegistry.
// All commands use the existing infrastructure — no keyboard handlers.
//
// Commands registered:
//   builder.delete     Delete selected nodes+edges
//   builder.copy       Copy selection to clipboard
//   builder.cut        Cut selection
//   builder.paste      Paste from clipboard
//   builder.undo       Undo last operation
//   builder.redo       Redo last operation
//   builder.selectAll  Select all nodes
//   builder.deselect   Deselect all
//   builder.autolayout Auto-layout all nodes
//   builder.collapse   Toggle collapsed
//   builder.duplicate  Duplicate selection
//
// @since 3.6.3

import { CommandRegistry } from '../../../workspace/services/CommandRegistry'

import type { GraphEditorRuntime } from './GraphEditorRuntime'

export function registerGraphCommands(
  registry: CommandRegistry,
  runtime: GraphEditorRuntime,
): void {
  registry.registerAll([
    {
      id: 'builder.delete',
      title: 'Delete Selected',
      category: 'builder',
      shortcut: 'Delete',
      icon: '🗑',
      execute: () => runtime.deleteSelected(),
      canExecute: () => runtime.canDelete(),
    },
    {
      id: 'builder.copy',
      title: 'Copy',
      category: 'builder',
      shortcut: 'Ctrl+C',
      icon: '📋',
      execute: () => runtime.copySelected(),
      canExecute: () => runtime.canCopy(),
    },
    {
      id: 'builder.cut',
      title: 'Cut',
      category: 'builder',
      shortcut: 'Ctrl+X',
      icon: '✂',
      execute: () => runtime.cutSelected(),
      canExecute: () => runtime.canCopy(),
    },
    {
      id: 'builder.paste',
      title: 'Paste',
      category: 'builder',
      shortcut: 'Ctrl+V',
      icon: '📄',
      execute: () => runtime.paste(),
      canExecute: () => runtime.canPaste(),
    },
    {
      id: 'builder.undo',
      title: 'Undo',
      category: 'builder',
      shortcut: 'Ctrl+Z',
      icon: '↩',
      execute: () => runtime.undo(),
      canExecute: () => runtime.canUndo(),
    },
    {
      id: 'builder.redo',
      title: 'Redo',
      category: 'builder',
      shortcut: 'Ctrl+Shift+Z',
      icon: '↪',
      execute: () => runtime.redo(),
      canExecute: () => runtime.canRedo(),
    },
    {
      id: 'builder.selectAll',
      title: 'Select All',
      category: 'builder',
      shortcut: 'Ctrl+A',
      execute: () => runtime.selectAll(),
    },
    {
      id: 'builder.deselect',
      title: 'Deselect All',
      category: 'builder',
      shortcut: 'Escape',
      execute: () => runtime.deselectAll(),
      canExecute: () => runtime.canDeselect(),
    },
    {
      id: 'builder.autolayout',
      title: 'Auto Layout',
      category: 'builder',
      shortcut: 'Ctrl+L',
      icon: '⚡',
      execute: () => runtime.autoLayout(),
    },
    {
      id: 'builder.duplicate',
      title: 'Duplicate',
      category: 'builder',
      shortcut: 'Ctrl+D',
      icon: '📝',
      execute: () => runtime.duplicateSelected(),
      canExecute: () => runtime.canCopy(),
    },
  ])
}
