// ── SetStopLossAction — places a stop-loss order ──
//
// Risk action: places a stop-loss order for the current position.
// If no position exists, returns an error.
//
// Parameters:
//   symbol    - trading symbol
//   stopPrice - stop price
//   quantity  - quantity to stop (defaults to full position)
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, orderSuccess, actionError } from '../utils/ActionHelpers'

export const SetStopLossAction: ActionDefinition = {
  id: 'set-stop-loss',
  name: 'Set Stop Loss',
  description: 'Places a stop-loss order for the current position',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'stopPrice', name: 'Stop Price', type: 'number', default: 0, description: 'Stop price', min: 0 },
    { id: 'quantity', name: 'Quantity', type: 'number', default: 0, description: 'Quantity (0 = full position)', min: 0 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const stopPrice = numberParam(params, 'stopPrice', 0)
    let quantity = numberParam(params, 'quantity', 0)

    if (stopPrice <= 0) return actionError('Stop price must be > 0')

    try {
      if (quantity <= 0) {
        const pos = await ctx.position.current(symbol)
        if (!pos) return actionError(`No position for ${symbol} — cannot set stop loss`)
        quantity = pos.size
      }

      const order = await ctx.orders.stopLoss(symbol, quantity, stopPrice)
      return orderSuccess(order, `Stop loss set: ${quantity} ${symbol} @ ${stopPrice}`)
    } catch (err) {
      return actionError(`Set stop loss failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
