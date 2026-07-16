// ── MoveStopToBreakevenAction — moves stop loss to entry price ──
//
// Risk action: sets the stop-loss order to the position's entry price,
// ensuring the trade cannot go into loss after being profitable.
//
// Parameters:
//   symbol - trading symbol
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, actionError } from '../utils/ActionHelpers'

export const MoveStopToBreakevenAction: ActionDefinition = {
  id: 'move-stop-to-breakeven',
  name: 'Move Stop to Breakeven',
  description: 'Moves stop loss to the position entry price',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')

    try {
      const pos = await ctx.position.current(symbol)
      if (!pos) return actionError(`No open position for ${symbol}`)

      // Place stop loss at entry price
      const order = await ctx.orders.stopLoss(symbol, pos.size, pos.entryPrice)
      return {
        success: true,
        orderId: order.id,
        message: `Stop loss moved to breakeven: ${pos.entryPrice} for ${pos.size} ${symbol}`,
      }
    } catch (err) {
      return actionError(`Move stop to breakeven failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
