// ── CancelAllOrdersAction — cancels all open orders ──
//
// Orders action: attempts to cancel all orders for a symbol.
// Note: this depends on the exchange's order tracking capability.
// If the OrderContext doesn't expose open orders, this action
// iterates recent order history and cancels unfilled orders.
//
// Parameters:
//   symbol - optional symbol filter (empty = all symbols)
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, actionError } from '../utils/ActionHelpers'

export const CancelAllOrdersAction: ActionDefinition = {
  id: 'cancel-all-orders',
  name: 'Cancel All Orders',
  description: 'Attempts to cancel all open orders',
  version: '1.0.0',
  parameters: [
    { id: 'symbol', name: 'Symbol', type: 'string', default: '', description: 'Symbol filter (empty = all)' },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const symbol = stringParam(params, 'symbol', '')

    try {
      // Try cancel all via history iteration
      const recentOrders = await ctx.orders.history(symbol || undefined, 50)
      let cancelled = 0
      const errors: string[] = []

      for (const order of recentOrders) {
        if (order.status === 'filled' || order.status === 'cancelled') continue
        try {
          const ok = await ctx.orders.cancel(order.id)
          if (ok) cancelled++
        } catch {
          errors.push(order.id)
        }
      }

      if (cancelled > 0) {
        return {
          success: true,
          message: `Cancelled ${cancelled} order(s)${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
          metadata: { cancelled, failed: errors.length },
        }
      }

      return { success: true, message: 'No open orders to cancel' }
    } catch (err) {
      return actionError(`Cancel all orders failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
