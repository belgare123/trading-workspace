// ── ReversePositionAction — reverse current position ──
//
// Position action: closes the current position and opens an opposite
// position with the same size (net: 2x original size in opposite direction).
//
// Parameters:
//   symbol - symbol to reverse
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, actionError } from '../utils/ActionHelpers'

export const ReversePositionAction: ActionDefinition = {
  id: 'reverse-position',
  name: 'Reverse Position',
  description: 'Closes current position and opens an opposite one',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')

    try {
      const pos = await ctx.position.current(symbol)
      if (!pos) {
        return actionError(`No open position for ${symbol} to reverse`)
      }

      // Close current position
      const closeOrder = pos.direction === 'long'
        ? await ctx.orders.marketSell(symbol, pos.size)
        : await ctx.orders.marketBuy(symbol, pos.size)

      // Open opposite position with same size
      const oppositeSize = pos.size * 2  // 1x to close + 1x to open opposite
      const openOrder = pos.direction === 'long'
        ? await ctx.orders.marketSell(symbol, oppositeSize)
        : await ctx.orders.marketBuy(symbol, oppositeSize)

      return {
        success: true,
        orderId: openOrder.id,
        message: `Reversed ${pos.direction} position ${pos.size} ${symbol} → ${pos.direction === 'long' ? 'short' : 'long'}`,
        metadata: { closeOrderId: closeOrder.id, openOrderId: openOrder.id },
      }
    } catch (err) {
      return actionError(`Reverse position failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
