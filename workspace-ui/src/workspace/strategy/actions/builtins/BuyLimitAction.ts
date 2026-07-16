// ── BuyLimitAction — limit buy ──
//
// Entry action: places a limit buy order at the specified price.
//
// Parameters:
//   symbol   - trading symbol
//   quantity - amount to buy
//   price    - limit price
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, orderSuccess, actionError } from '../utils/ActionHelpers'

export const BuyLimitAction: ActionDefinition = {
  id: 'buy-limit',
  name: 'Buy Limit',
  description: 'Places a limit buy order',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'quantity', name: 'Quantity', type: 'number', default: 0.001, description: 'Amount to buy', min: 0.00001 },
    { id: 'price', name: 'Price', type: 'number', default: 0, description: 'Limit price', min: 0 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const quantity = numberParam(params, 'quantity', 0.001)
    const price = numberParam(params, 'price', 0)

    if (price <= 0) return actionError('Limit price must be > 0')

    try {
      const order = await ctx.orders.limitBuy(symbol, quantity, price)
      return orderSuccess(order, `Limit buy ${quantity} ${symbol} @ ${price}`)
    } catch (err) {
      return actionError(`Limit buy failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
