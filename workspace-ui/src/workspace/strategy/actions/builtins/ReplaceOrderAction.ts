// ── ReplaceOrderAction — replaces an existing order ──
//
// Orders action: cancels an existing order and places a new one
// with the same direction/type but updated parameters.
//
// Parameters:
//   oldOrderId  - ID of the order to replace
//   symbol      - trading symbol
//   newPrice    - new price (for limit/stop orders)
//   newQuantity - new quantity (0 = keep original)
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, numberParam, actionError } from '../utils/ActionHelpers'

export const ReplaceOrderAction: ActionDefinition = {
  id: 'replace-order',
  name: 'Replace Order',
  description: 'Cancels an existing order and places a replacement',
  version: '1.0.0',
  parameters: [
    { id: 'oldOrderId', name: 'Old Order ID', type: 'string', default: '', description: 'Order ID to replace' },
    { id: 'symbol', name: 'Symbol', type: 'string', default: 'BTC/USDT', description: 'Trading symbol' },
    { id: 'newPrice', name: 'New Price', type: 'number', default: 0, description: 'New limit/stop price', min: 0 },
    { id: 'newQuantity', name: 'New Quantity', type: 'number', default: 0, description: 'New quantity (0 = keep original)', min: 0 },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const oldOrderId = stringParam(params, 'oldOrderId', '')
    const symbol = stringParam(params, 'symbol', 'BTC/USDT')
    const newPrice = numberParam(params, 'newPrice', 0)
    const newQuantity = numberParam(params, 'newQuantity', 0)

    if (!oldOrderId) return actionError('oldOrderId is required')

    try {
      // Get old order details
      const oldOrder = await ctx.orders.status(oldOrderId)
      const qty = newQuantity > 0 ? newQuantity : oldOrder.quantity

      // Cancel old order
      await ctx.orders.cancel(oldOrderId)

      // Place replacement
      let newOrder
      if (oldOrder.type === 'limit') {
        if (oldOrder.side === 'buy') {
          newOrder = await ctx.orders.limitBuy(symbol, qty, newPrice || oldOrder.price)
        } else {
          newOrder = await ctx.orders.limitSell(symbol, qty, newPrice || oldOrder.price)
        }
      } else if (oldOrder.type === 'stop' || oldOrder.type === 'stop_limit') {
        const sp = newPrice > 0 ? newPrice : oldOrder.price
        newOrder = await ctx.orders.stopLoss(symbol, qty, sp)
      } else {
        // Market orders can't be replaced — just place new one
        if (oldOrder.side === 'buy') {
          newOrder = await ctx.orders.marketBuy(symbol, qty)
        } else {
          newOrder = await ctx.orders.marketSell(symbol, qty)
        }
      }

      return {
        success: true,
        orderId: newOrder.id,
        message: `Replaced order ${oldOrderId} → ${newOrder.id}`,
        metadata: { oldOrderId, newOrderId: newOrder.id },
      }
    } catch (err) {
      return actionError(`Replace order failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
