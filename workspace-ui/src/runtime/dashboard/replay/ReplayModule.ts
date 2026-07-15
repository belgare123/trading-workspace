/**
 * ReplayModule — stub for the Replay workspace screen.
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from '../../modules/types'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { Play } from 'lucide-react'

export const ReplayModule: ClientModule = {
  id: 'replay',
  name: 'Replay Studio',
  version: '3.1.3',
  description: 'Replay Studio: timeline, bookmarks, speed, annotations',
  dependsOn: ['workspace-foundation'],

  registerResources(_context: RuntimeContext): void {
    // Resources will be added in Sprint 3.1.6
  },

  registerPresentation(): void {
    PresetRegistry.register({
      id: 'replay',
      title: 'Replay',
      description: 'Replay Studio: timeline, bookmarks, speed, annotations',
      screens: [{ id: 'replay', title: 'Replay', layout: 'single', widgets: ['replay-controls', 'replay-timeline'] }],
    })
    ScreenRegistry.register({ id: 'replay', title: 'Replay Studio', preset: 'replay', icon: Play, category: 'workspace', order: 70 })
  },
}
