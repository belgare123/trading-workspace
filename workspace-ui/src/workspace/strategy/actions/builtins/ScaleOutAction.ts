// ── ScaleOutAction — reduce position size ──
//
// Position action: reduces the current position by the specified amount.
//
// Parameters:
//   symbol     - trading symbol
//   reduceBy   - quantity to reduce (must be <= current position size)
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, orderSuccess, actionError } from '../utils/ActionHelpers'

export const ScaleOutAction: ActionDefinition = {
  id: 'scale-out',
  name: 'Scale Out',
  description: 'Reduces the current position by the specified amount',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'reduceBy', name: 'Reduce By', type: 'number', default: 0.001, description: 'Quantity to reduce', min: 0.00001 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const reduceBy = numberParam(params, 'reduceBy', 0.001)

    try {
      const pos = await ctx.position.current(symbol)
      if (!pos) {
        return actionError(`No open position for ${symbol} to scale out`)
      }

      if (reduceBy > pos.size) {
        return actionError(`Cannot reduce by ${reduceBy} — position size is only ${pos.size}`)
      }

      const order = pos.direction === 'long'
        ? await ctx.orders.marketSell(symbol, reduceBy)
        : await ctx.orders.marketBuy(symbol, reduceBy)

      return orderSuccess(order, `Scaled out: reduced ${pos.direction} ${symbol} by ${reduceBy} (remaining ${(pos.size - reduceBy).toFixed(8)})`)
    } catch (err) {
      return actionError(`Scale out failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
