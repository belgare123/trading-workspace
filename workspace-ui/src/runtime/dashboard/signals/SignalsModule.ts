/**
 * SignalsModule — stub for the Signals workspace screen.
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from '../../modules/types'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { Radio } from 'lucide-react'

export const SignalsModule: ClientModule = {
  id: 'signals',
  name: 'Signals',
  version: '3.1.3',
  description: 'Signal center: confidence, risk, reason, execution',
  dependsOn: ['workspace-foundation'],

  registerResources(_context: RuntimeContext): void {
    // Resources will be added in Sprint 3.1.4
  },

  registerPresentation(): void {
    PresetRegistry.register({
      id: 'signals',
      title: 'Signals',
      description: 'Signal center: confidence, risk, reason, execution',
      screens: [{ id: 'signals', title: 'Signals', layout: 'single', widgets: ['signal-feed', 'signal-detail'] }],
    })
    ScreenRegistry.register({ id: 'signals', title: 'Signals', preset: 'signals', icon: Radio, category: 'workspace', order: 30 })
  },
}
