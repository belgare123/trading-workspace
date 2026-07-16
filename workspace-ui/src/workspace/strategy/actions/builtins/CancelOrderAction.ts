// ── CancelOrderAction — cancels a specific order ──
//
// Orders action: cancels an order by its ID.
//
// Parameters:
//   orderId - ID of the order to cancel
//
// @since 3.4.5

import type { ActionDefinition } from '../definition/ActionDefinition'
import type { ActionResult } from '../types'
import { stringParam, actionError } from '../utils/ActionHelpers'

export const CancelOrderAction: ActionDefinition = {
  id: 'cancel-order',
  name: 'Cancel Order',
  description: 'Cancels a specific order by ID',
  version: '1.0.0',
  parameters: [
    { id: 'orderId', name: 'Order ID', type: 'string', default: '', description: 'Order ID to cancel' },
  ],

  async execute(ctx, params): Promise<ActionResult> {
    const orderId = stringParam(params, 'orderId', '')

    if (!orderId) return actionError('orderId is required')

    try {
      const cancelled = await ctx.orders.cancel(orderId)
      if (cancelled) {
        return { success: true, orderId, message: `Order ${orderId} cancelled` }
      }
      return actionError(`Order ${orderId} not found or already filled/cancelled`)
    } catch (err) {
      return actionError(`Cancel order failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
