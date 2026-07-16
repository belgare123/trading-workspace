/**
 * LiveModule.ts — Live Trading workspace module
 *
 * Registers the Live Trading screen in ScreenRegistry and
 * the Live panels in PanelRegistry.
 *
 * @since 4.8
 */

import { ScreenRegistry } from '../../runtime/dashboard/screen/ScreenRegistry'
import { registerLivePanels } from '../../workspace/live/live/LivePanels'
import { Activity } from 'lucide-react'

/**
 * Initialize the Live Trading workspace module.
 * Registers the screen and all Live panels.
 */
export function registerLiveModule(): void {
  // Register all 6 Live panels
  registerLivePanels()

  // Register the Live Trading screen
  ScreenRegistry.register({
    id: 'live',
    title: 'Live Trading',
    icon: Activity,
    category: 'trading',
    order: 10,
  })

  if (import.meta.env.DEV) {
    console.log('[LiveModule] Registered 6 panels, 1 screen')
  }
}
