/**
 * WorkspaceServices — dependency injection container for workspace services
 *
 * Single point of construction for all workspace-level services:
 *   - UndoManager (connects OperationHistory ↔ LayoutEngine)
 *   - CommandRegistry (global commands with shortcuts)
 *   - SerializerService (full workspace export/import)
 *
 * Usage:
 *   import { layoutEngine } from '../layout/LayoutEngine'
 *   import { dockController } from '../docking/DockController'
 *   const services = new WorkspaceServices(layoutEngine, dockController.history)
 *
 * @since 3.2.4
 */

import type { LayoutEngine } from '../layout/LayoutEngine'
import { OperationHistory } from '../docking/OperationHistory'
import type { LayoutCommand, Operation, OperationType } from '../docking/types'
import { UndoManager } from './UndoManager'
import { CommandRegistry } from './CommandRegistry'
import { createWorkspaceCommands } from './createWorkspaceCommands'
import { SerializerService } from './SerializerService'

export class WorkspaceServices {
  /** Layout engine reference */
  readonly engine: LayoutEngine

  /** Undo/Redo manager — wraps OperationHistory ↔ LayoutEngine */
  readonly undoManager: UndoManager

  /** Central command registry with shortcuts */
  readonly commandRegistry: CommandRegistry

  /** Workspace export/import with version migration */
  readonly serializer: SerializerService

  /** Reference to the underlying OperationHistory (shared with DockController) */
  readonly operationHistory: OperationHistory

  constructor(engine: LayoutEngine, operationHistory?: OperationHistory) {
    this.engine = engine
    this.operationHistory = operationHistory ?? new OperationHistory()
    this.undoManager = new UndoManager(engine, this.operationHistory)
    this.serializer = new SerializerService()
    this.commandRegistry = new CommandRegistry()

    // Register default workspace commands
    this.commandRegistry.registerAll(
      createWorkspaceCommands(this.undoManager, engine),
    )
  }

  /**
   * Register an operation in history.
   * Convenience method — delegates to OperationHistory.record.
   */
  recordOperation(
    type: OperationType,
    command: LayoutCommand,
    before: unknown[],
    after: unknown[],
    description: string,
  ): Operation {
    return this.operationHistory.record(type, command, before, after, description)
  }
}
