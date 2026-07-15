/**
 * MarketsModule — reusable market surveillance widget library.
 *
 * Wraps registerMarketsResources/Presentation in the ClientModule contract.
 * Resources: providers + widgets. Presentation: screen + preset.
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from '../../modules/types'
import { registerMarketsResources, registerMarketsPresentation } from './registerMarkets'

export const MarketsModule: ClientModule = {
  id: 'markets',
  name: 'Markets',
  version: '3.1.3',
  description: 'Market surveillance: charts, depth, trades, liquidations, alerts, news',
  dependsOn: ['workspace-foundation'],

  registerResources(_context: RuntimeContext): void {
    registerMarketsResources()
  },

  registerPresentation(_context: RuntimeContext): void {
    registerMarketsPresentation()
  },
}
