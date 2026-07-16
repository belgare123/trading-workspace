// ── SetTakeProfitAction — places a take-profit order ──
//
// Risk action: places a take-profit limit order for the current position.
//
// Parameters:
//   symbol       - trading symbol
//   targetPrice  - take-profit price
//   quantity     - quantity (0 = full position)
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, orderSuccess, actionError } from '../utils/ActionHelpers'

export const SetTakeProfitAction: ActionDefinition = {
  id: 'set-take-profit',
  name: 'Set Take Profit',
  description: 'Places a take-profit limit order for the current position',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'targetPrice', name: 'Target Price', type: 'number', default: 0, description: 'Take-profit price', min: 0 },
    { id: 'quantity', name: 'Quantity', type: 'number', default: 0, description: 'Quantity (0 = full position)', min: 0 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const targetPrice = numberParam(params, 'targetPrice', 0)
    let quantity = numberParam(params, 'quantity', 0)

    if (targetPrice <= 0) return actionError('Target price must be > 0')

    try {
      if (quantity <= 0) {
        const pos = await ctx.position.current(symbol)
        if (!pos) return actionError(`No position for ${symbol} — cannot set take profit`)
        quantity = pos.size
      }

      const order = await ctx.orders.takeProfit(symbol, quantity, targetPrice)
      return orderSuccess(order, `Take profit set: ${quantity} ${symbol} @ ${targetPrice}`)
    } catch (err) {
      return actionError(`Set take profit failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
