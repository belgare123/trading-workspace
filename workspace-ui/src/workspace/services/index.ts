/**
 * index.ts — Workspace Services barrel export
 *
 * @since 3.2.4
 */

export { UndoManager } from './UndoManager'
export { CommandRegistry } from './CommandRegistry'
export type { Command } from './CommandRegistry'
export { createWorkspaceCommands } from './createWorkspaceCommands'
export { useKeyboardBinding } from './useKeyboardBinding'
export { SerializerService } from './SerializerService'
export type { WorkspaceExport } from './SerializerService'
export { WORKSPACE_FORMAT_VERSION } from './SerializerService'
export { WorkspaceServices } from './WorkspaceServices'
export { workspaceServices, WorkspaceServicesProvider, useWorkspaceServices } from './WorkspaceServicesProvider'
