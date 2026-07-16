// ── ScaleInAction — increase position size ──
//
// Position action: adds to the current position in the same direction.
// If no position exists, opens a new one with the additional size.
//
// Parameters:
//   symbol     - trading symbol
//   additional - additional quantity to add
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, orderSuccess, actionError } from '../utils/ActionHelpers'

export const ScaleInAction: ActionDefinition = {
  id: 'scale-in',
  name: 'Scale In',
  description: 'Adds to the current position in the same direction',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'additional', name: 'Additional Size', type: 'number', default: 0.001, description: 'Additional quantity', min: 0.00001 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const additional = numberParam(params, 'additional', 0.001)

    try {
      const pos = await ctx.position.current(symbol)

      if (pos) {
        // Add to existing position in same direction
        const order = pos.direction === 'long'
          ? await ctx.orders.marketBuy(symbol, additional)
          : await ctx.orders.marketSell(symbol, additional)
        return orderSuccess(order, `Scaled in: added ${additional} ${symbol} to ${pos.direction} position`)
      }

      // No existing position — open a default long
      const order = await ctx.orders.marketBuy(symbol, additional)
      return orderSuccess(order, `Scale in as new long: ${additional} ${symbol}`)
    } catch (err) {
      return actionError(`Scale in failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
