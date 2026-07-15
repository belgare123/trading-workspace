/**
 * PortfolioModule — stub for the Portfolio workspace screen.
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from '../../modules/types'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { PieChart } from 'lucide-react'

export const PortfolioModule: ClientModule = {
  id: 'portfolio',
  name: 'Portfolio',
  version: '3.1.3',
  description: 'Portfolio: balance, exposure, PnL, risk, drawdown',
  dependsOn: ['workspace-foundation'],

  registerResources(_context: RuntimeContext): void {
    // Resources will be added in Sprint 3.1.4
  },

  registerPresentation(): void {
    PresetRegistry.register({
      id: 'portfolio',
      title: 'Portfolio',
      description: 'Portfolio: balance, exposure, PnL, risk, drawdown',
      screens: [{ id: 'portfolio', title: 'Portfolio', layout: '2-column', widgets: ['portfolio-summary', 'portfolio-allocation', 'portfolio-risk', 'positions-table'] }],
    })
    ScreenRegistry.register({ id: 'portfolio', title: 'Portfolio', preset: 'portfolio', icon: PieChart, category: 'workspace', order: 40 })
  },
}
