/**
 * BrokerEventAdapter.ts — Broker events → ExecutionEvent converter
 *
 * Subscribes to broker event streams (WebSocket order updates, fills, positions)
 * via the sub-adapter interfaces and converts them to platform ExecutionEvents.
 *
 * @since 4.5
 */

import type { BrokerAdapter } from './BrokerAdapter'
import type { BrokerOrder, BrokerFill as BrokerFillModel, BrokerPosition as BrokerPositionModel } from './types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { Order, Fill, Position, OrderType, OrderStatus, TimeInForce } from '../../execution/types'

export class BrokerEventAdapter {
  private adapter: BrokerAdapter
  private eventBus?: ExecutionEventBus
  private active = false
  private unsubscribers: Array<() => void> = []

  constructor(adapter: BrokerAdapter) {
    this.adapter = adapter
  }

  /** Connect event bus and start subscribing to broker events */
  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus
    this.active = true

    // Subscribe to order updates via OrderAdapter
    this.unsubscribers.push(
      this.adapter.orders.subscribeOrders((brokerOrder) => {
        if (!this.active || !this.eventBus) return

        const order = this.toOrder(brokerOrder)
        if (!order) return

        if (brokerOrder.status === 'FILLED' || brokerOrder.status === 'PARTIALLY_FILLED') {
          this.eventBus.emit({
            type: 'ORDER_FILLED',
            order,
            fill: this.toFill(brokerOrder),
            timestamp: brokerOrder.updatedAt,
          })
        }

        if (brokerOrder.status === 'CANCELLED' || brokerOrder.status === 'EXPIRED' || brokerOrder.status === 'REJECTED') {
          this.eventBus.emit({
            type: 'ORDER_CANCELLED',
            order,
            timestamp: brokerOrder.updatedAt,
          })
        }
      })
    )

    // Subscribe to fill events via OrderAdapter
    this.unsubscribers.push(
      this.adapter.orders.subscribeFills((brokerFill) => {
        if (!this.active || !this.eventBus) return
        const fill = this.toFillFromModel(brokerFill)
        if (!fill) return

        this.eventBus.emit({
          type: 'ORDER_FILLED',
          order: {
            id: brokerFill.orderId,
            strategyId: '',
            symbol: brokerFill.symbol,
            side: brokerFill.side === 'buy' ? 'buy' : 'sell',
            type: 'market',
            quantity: brokerFill.quantity,
            filledQuantity: brokerFill.quantity,
            averagePrice: brokerFill.price,
            status: 'filled',
            commission: brokerFill.commission,
            timeInForce: 'GTC',
            createdAt: brokerFill.timestamp,
            updatedAt: brokerFill.timestamp,
          },
          fill,
          timestamp: brokerFill.timestamp,
        })
      })
    )

    // Subscribe to position updates via PositionAdapter
    this.unsubscribers.push(
      this.adapter.positions.subscribePositions((brokerPos) => {
        if (!this.active || !this.eventBus) return

        this.eventBus.emit({
          type: 'POSITION_UPDATED',
          position: this.toPosition(brokerPos),
          timestamp: brokerPos.updatedAt,
        })
      })
    )

    // Subscribe to balance updates via AccountAdapter
    // Subscribe to balance updates via AccountAdapter
    this.unsubscribers.push(
      this.adapter.account.subscribeBalances(() => {
        // Balance-only events are handled by AccountSynchronizer via REST poll
        // Push events here are supplemental
      })
    )
  }

  /** Clean up */
  dispose(): void {
    this.active = false
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
  }

  // ── Mappers ──

  private toOrder(brokerOrder: BrokerOrder): Order | null {
    return {
      id: brokerOrder.clientOrderId ?? brokerOrder.brokerOrderId,
      strategyId: '',
      symbol: brokerOrder.symbol,
      side: brokerOrder.side === 'buy' ? 'buy' : 'sell',
      type: this.mapType(brokerOrder.type),
      quantity: brokerOrder.quantity,
      filledQuantity: brokerOrder.filledQuantity,
      averagePrice: brokerOrder.averagePrice,
      price: brokerOrder.price,
      status: this.mapStatus(brokerOrder.status),
      commission: brokerOrder.commission,
      timeInForce: (brokerOrder.timeInForce ?? 'GTC') as TimeInForce,
      reduceOnly: brokerOrder.reduceOnly,
      createdAt: brokerOrder.createdAt,
      updatedAt: brokerOrder.updatedAt,
    }
  }

  private toFill(brokerOrder: BrokerOrder): Fill {
    return {
      id: `fill_${brokerOrder.brokerOrderId}_${brokerOrder.updatedAt}`,
      orderId: brokerOrder.clientOrderId ?? brokerOrder.brokerOrderId,
      symbol: brokerOrder.symbol,
      side: brokerOrder.side === 'buy' ? 'buy' : 'sell',
      quantity: brokerOrder.filledQuantity,
      price: brokerOrder.averagePrice,
      commission: brokerOrder.commission,
      commissionAsset: brokerOrder.commissionAsset ?? '',
      slippage: 0,
      timestamp: brokerOrder.updatedAt,
    }
  }

  private toFillFromModel(brokerFill: BrokerFillModel): Fill | null {
    return {
      id: brokerFill.id,
      orderId: brokerFill.orderId,
      symbol: brokerFill.symbol,
      side: brokerFill.side === 'buy' ? 'buy' : 'sell',
      quantity: brokerFill.quantity,
      price: brokerFill.price,
      commission: brokerFill.commission,
      commissionAsset: brokerFill.commissionAsset ?? '',
      slippage: 0,
      timestamp: brokerFill.timestamp,
    }
  }

  private toPosition(brokerPos: BrokerPositionModel): Position {
    return {
      symbol: brokerPos.symbol,
      direction: brokerPos.direction,
      quantity: brokerPos.quantity,
      averageEntryPrice: brokerPos.averageEntryPrice,
      currentPrice: brokerPos.currentPrice,
      unrealizedPnl: brokerPos.unrealizedPnl,
      realizedPnl: brokerPos.realizedPnl,
      openedAt: 0,
      updatedAt: Date.now(),
    }
  }

  private mapType(brokerType: string): OrderType {
    const t = brokerType.toUpperCase()
    if (['MARKET'].includes(t)) return 'market' as OrderType
    if (['LIMIT'].includes(t)) return 'limit' as OrderType
    if (['STOP', 'STOP_LOSS'].includes(t)) return 'stop' as OrderType
    if (['STOP_LIMIT', 'STOP_LOSS_LIMIT'].includes(t)) return 'stop_limit' as OrderType
    return 'limit' as OrderType
  }

  private mapStatus(brokerStatus: string): OrderStatus {
    switch (brokerStatus.toUpperCase()) {
      case 'NEW': return 'pending' as OrderStatus
      case 'PARTIALLY_FILLED': return 'partially_filled' as OrderStatus
      case 'FILLED': return 'filled' as OrderStatus
      case 'CANCELLED':
      case 'CANCELED': return 'cancelled' as OrderStatus
      case 'EXPIRED': return 'expired' as OrderStatus
      case 'REJECTED': return 'rejected' as OrderStatus
      default: return 'pending' as OrderStatus
    }
  }
}
