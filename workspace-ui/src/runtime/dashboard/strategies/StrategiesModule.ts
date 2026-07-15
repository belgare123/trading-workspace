/**
 * StrategiesModule — stub for the Strategies workspace screen.
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from '../../modules/types'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { BrainCircuit } from 'lucide-react'

export const StrategiesModule: ClientModule = {
  id: 'strategies',
  name: 'Strategies',
  version: '3.1.3',
  description: 'Strategies: signals, profit, Sharpe, CPU, events/sec',
  dependsOn: ['workspace-foundation'],

  registerResources(_context: RuntimeContext): void {
    // Resources will be added in Sprint 3.1.4
  },

  registerPresentation(): void {
    PresetRegistry.register({
      id: 'strategies',
      title: 'Strategies',
      description: 'Strategy runtime: signals, profit, Sharpe, CPU, events/sec',
      screens: [{ id: 'strategies', title: 'Strategies', layout: '2-column', widgets: ['strategies-overview', 'strategy-detail'] }],
    })
    ScreenRegistry.register({ id: 'strategies', title: 'Strategies', preset: 'strategies', icon: BrainCircuit, category: 'workspace', order: 50 })
  },
}
