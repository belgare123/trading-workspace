// ── ReplaceManager — cancel/replace with race handling ──

import { Order, type OrderId } from '../Order'
import type { PlaceOrderRequest } from '../runtime/interfaces'

/** Result of a replace operation */
export interface ReplaceResult {
  cancelledOrderId: string
  newOrderId: string
  newOrder: Order
}

/** Interface for the Gateway operations needed by ReplaceManager */
export interface IReplaceGateway {
  cancelOrder(orderId: string): Promise<{ success: boolean }>
  placeOrder(request: PlaceOrderRequest): Promise<Order>
}

export class ReplaceManager {
  private gateway: IReplaceGateway

  constructor(gateway: IReplaceGateway) {
    this.gateway = gateway
  }

  /**
   * Cancel an existing order and place a new one with updated parameters.
   *
   * Flow:
   * 1. Cancel old order
   * 2. Wait for cancel confirmation
   * 3. Create new order with updated params
   * 4. Return replace result
   */
  async replace(
    existingOrder: Order,
    newParams: Partial<PlaceOrderRequest>,
  ): Promise<ReplaceResult> {
    const cancelledOrderId = existingOrder.id

    // 1. Cancel existing order
    const cancelResult = await this.gateway.cancelOrder(cancelledOrderId)

    if (!cancelResult.success) {
      throw Object.assign(
        new Error(`ReplaceManager: cancel failed for ${cancelledOrderId}`),
        { code: 'CANCEL_FAILED', orderId: cancelledOrderId },
      )
    }

    // 2. Build new order request from existing order + overrides
    const request: PlaceOrderRequest = {
      tradeId: newParams.tradeId ?? existingOrder.tradeId ?? '',
      symbol: newParams.symbol ?? existingOrder.symbol,
      side: newParams.side ?? existingOrder.side as 'buy' | 'sell',
      type: newParams.type ?? existingOrder.type as any,
      quantity: newParams.quantity ?? existingOrder.quantity,
      price: newParams.price ?? existingOrder.price,
      reduceOnly: newParams.reduceOnly ?? existingOrder.reduceOnly,
      timeInForce: newParams.timeInForce ?? existingOrder.timeInForce,
    }

    // 3. Place new order
    const newOrder = await this.gateway.placeOrder(request)

    return {
      cancelledOrderId,
      newOrderId: newOrder.id,
      newOrder,
    }
  }

  /**
   * Amend — same as replace unless the broker supports amend natively.
   * For brokers that don't support amend, this is identical to replace.
   */
  async amend(
    existingOrder: Order,
    newParams: Partial<PlaceOrderRequest>,
  ): Promise<ReplaceResult> {
    // Same as replace by default
    return this.replace(existingOrder, newParams)
  }
}
