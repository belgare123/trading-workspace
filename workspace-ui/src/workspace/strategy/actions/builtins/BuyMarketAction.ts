// ── BuyMarketAction — market buy ──
//
// Entry action: places a market buy order for the given symbol and quantity.
//
// Parameters:
//   symbol   - trading symbol (e.g. 'BTC/USDT')
//   quantity - amount to buy
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, orderSuccess, actionError } from '../utils/ActionHelpers'

export const BuyMarketAction: ActionDefinition = {
  id: 'buy-market',
  name: 'Buy Market',
  description: 'Places a market buy order',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'quantity', name: 'Quantity', type: 'number', default: 0.001, description: 'Amount to buy', min: 0.00001 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const quantity = numberParam(params, 'quantity', 0.001)

    try {
      const order = await ctx.orders.marketBuy(symbol, quantity)
      return orderSuccess(order, `Market buy ${quantity} ${symbol}`)
    } catch (err) {
      return actionError(`Market buy failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
