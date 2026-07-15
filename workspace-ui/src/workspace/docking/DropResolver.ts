/**
 * DropResolver — maps DockTarget to LayoutCommand
 *
 * This is the ONLY place that knows how to translate dock targets
 * into layout operations. It has two modes:
 *   1. `resolve()` — pure function: DockTarget → LayoutCommand (no side effects)
 *   2. `execute()` — applies a LayoutCommand to LayoutEngine
 *
 * Separating command generation from execution enables:
 *   - History recording (capture before/after snapshots)
 *   - Layout replay and macros
 *   - Collaborative editing
 *   - Serialization of layout operations
 *
 * @since 3.2.3
 */

import type { LayoutEngine } from '../layout/LayoutEngine'
import type { Panel } from '../layout/types'
import type { DockTarget } from './types'
import type { LayoutCommand, CommandResult } from './types'

/** Deep-clone an array of panels for history snapshots */
export function clonePanels(panels: Panel[]): Panel[] {
  return JSON.parse(JSON.stringify(panels))
}

export class DropResolver {
  private engine: LayoutEngine

  constructor(engine: LayoutEngine) {
    this.engine = engine
  }

  /**
   * Resolve a dock target into a LayoutCommand.
   *
   * PURE function — no side effects. Returns a command description
   * that can be inspected, recorded, serialized, or executed later.
   *
   * @param target  Where to drop
   * @param sourcePanel  The panel being dragged
   * @returns LayoutCommand or null if the target is invalid
   */
  resolve(target: DockTarget, sourcePanel: Panel): LayoutCommand | null {
    switch (target.zone) {
      case 'center':
        return {
          type: 'dock',
          targetPanelId: target.panelId,
          sourcePanelId: sourcePanel.id,
          sourcePanel,
        }

      case 'left':
      case 'right':
      case 'top':
      case 'bottom':
        return {
          type: 'split',
          targetPanelId: target.panelId,
          zone: target.zone,
          panel: sourcePanel,
        }

      case 'floating':
        return {
          type: 'float',
          panelId: target.panelId,
        }

      default:
        return null
    }
  }

  /**
   * Execute a LayoutCommand on the LayoutEngine.
   *
   * This is the ONLY place that calls into LayoutEngine.
   * Returns the result of the operation.
   */
  execute(command: LayoutCommand): CommandResult {
    switch (command.type) {
      case 'dock': {
        const newTab = {
          id: command.sourcePanel.id,
          widgetId: command.sourcePanel.widgetId,
          title: command.sourcePanel.title,
        }
        this.engine.addTab(command.targetPanelId, newTab)
        this.engine.removePanel(command.sourcePanelId)
        this.engine.activateTab(command.targetPanelId, newTab.id)
        return {
          success: true,
          operation: 'dock',
          description: `Docked '${command.sourcePanel.title}' as tab in '${command.targetPanelId}'`,
        }
      }

      case 'split': {
        const splitSuccess = this.engine.splitPanel(command.targetPanelId, command.zone, command.panel)

        if (splitSuccess) {
          this.engine.removePanel(command.panel.id)
        }

        return {
          success: splitSuccess,
          operation: 'split',
          description: `Split '${command.targetPanelId}' ${command.zone} with '${command.panel.title}'`,
        }
      }

      case 'float': {
        this.engine.toggleFloating(command.panelId)
        return {
          success: true,
          operation: 'float',
          description: `Floated panel '${command.panelId}'`,
        }
      }

      case 'close': {
        this.engine.removePanel(command.panelId)
        return {
          success: true,
          operation: 'close',
          description: `Closed panel '${command.panelId}'`,
        }
      }

      case 'move': {
        this.engine.updatePanel(command.panelId, command.position)
        return {
          success: true,
          operation: 'move',
          description: `Moved panel '${command.panelId}'`,
        }
      }

      default:
        return {
          success: false,
          operation: 'unknown',
          description: `Unknown command type: ${(command as any).type}`,
        }
    }
  }
}
