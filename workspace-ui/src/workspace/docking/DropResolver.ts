/**
 * DropResolver — maps DockTarget to LayoutEngine API calls
 *
 * This is the ONLY place that calls into LayoutEngine.
 * DockController calls resolve() with the target; DropResolver
 * translates it to LayoutEngine methods without exposing the engine.
 *
 * @since 3.2.3
 */

import type { LayoutEngine } from '../layout/LayoutEngine'
import type { Panel } from '../layout/types'
import type { DockTarget } from './types'

export interface DropResolution {
  success: boolean
  operation: string
  description: string
}

export class DropResolver {
  private engine: LayoutEngine

  constructor(engine: LayoutEngine) {
    this.engine = engine
  }

  /**
   * Resolve a dock target into a LayoutEngine operation.
   *
   * @param target  Where to drop
   * @param sourcePanel  The panel being dragged
   * @param widgetId  Optional widget id for split panels (defaults to source panel's widget)
   * @param title  Optional title for split panels
   */
  resolve(
    target: DockTarget,
    sourcePanel: Panel,
    widgetId?: string,
    title?: string,
  ): DropResolution {
    switch (target.zone) {
      case 'center': {
        // Tab docking: add source widget as a tab to target panel
        const newTab = {
          id: sourcePanel.id,
          widgetId: sourcePanel.widgetId,
          title: sourcePanel.title,
        }
        this.engine.addTab(target.panelId, newTab)
        this.engine.removePanel(sourcePanel.id)
        this.engine.activateTab(target.panelId, newTab.id)
        return {
          success: true,
          operation: 'dock',
          description: `Docked '${sourcePanel.title}' as tab in '${target.panelId}'`,
        }
      }

      case 'left':
      case 'right':
      case 'top':
      case 'bottom': {
        // Split the target panel
        const newWidget = widgetId || sourcePanel.widgetId
        const newTitle = title || sourcePanel.title
        const splitSuccess = this.engine.splitPanel(target.panelId, target.zone, {
          id: sourcePanel.id,
          widgetId: newWidget,
          title: newTitle,
          position: { x: 0, y: 0, width: 1, height: 1 },
          tabs: sourcePanel.tabs,
          floating: false,
          pinned: false,
          collapsed: false,
          minimized: false,
          state: {},
        })

        if (splitSuccess) {
          // Remove the original source panel if it still exists
          this.engine.removePanel(sourcePanel.id)
        }

        return {
          success: splitSuccess,
          operation: 'split',
          description: `Split '${target.panelId}' ${target.zone} with '${newTitle}'`,
        }
      }

      case 'floating': {
        this.engine.toggleFloating(target.panelId)
        return {
          success: true,
          operation: 'float',
          description: `Floated panel '${target.panelId}'`,
        }
      }

      default:
        return {
          success: false,
          operation: 'unknown',
          description: `Unknown dock zone: ${target.zone}`,
        }
    }
  }
}
