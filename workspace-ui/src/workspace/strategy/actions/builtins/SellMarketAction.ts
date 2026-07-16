// ── SellMarketAction — market sell ──
//
// Entry action: places a market sell order for the given symbol and quantity.
//
// Parameters:
//   symbol   - trading symbol (e.g. 'BTC/USDT')
//   quantity - amount to sell
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, orderSuccess, actionError } from '../utils/ActionHelpers'

export const SellMarketAction: ActionDefinition = {
  id: 'sell-market',
  name: 'Sell Market',
  description: 'Places a market sell order',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'quantity', name: 'Quantity', type: 'number', default: 0.001, description: 'Amount to sell', min: 0.00001 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const quantity = numberParam(params, 'quantity', 0.001)

    try {
      const order = await ctx.orders.marketSell(symbol, quantity)
      return orderSuccess(order, `Market sell ${quantity} ${symbol}`)
    } catch (err) {
      return actionError(`Market sell failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
