// ── ClosePositionAction — close current position ──
//
// Position action: closes the current position for a symbol by
// placing an opposite-direction market order with the position size.
//
// Parameters:
//   symbol - symbol to close
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, actionError } from '../utils/ActionHelpers'

export const ClosePositionAction: ActionDefinition = {
  id: 'close-position',
  name: 'Close Position',
  description: 'Closes the current position by placing an opposite market order',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')

    try {
      const pos = await ctx.position.current(symbol)
      if (!pos) {
        return actionError(`No open position for ${symbol}`)
      }

      const order = pos.direction === 'long'
        ? await ctx.orders.marketSell(symbol, pos.size)
        : await ctx.orders.marketBuy(symbol, pos.size)

      return {
        success: true,
        orderId: order.id,
        positionId: `${symbol}:${pos.direction}`,
        message: `Closed ${pos.direction} position ${pos.size} ${symbol}`,
      }
    } catch (err) {
      return actionError(`Close position failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
