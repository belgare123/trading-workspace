/**
 * BrokerEventAdapter.ts — Broker events → ExecutionEvent converter
 *
 * Subscribes to broker event streams (websocket order updates, fills, positions)
 * and converts them to platform ExecutionEventBus events.
 *
 * @since 4.5
 */

import type { BrokerAdapter } from './BrokerAdapter'
import type { BrokerEvent, BrokerOrderStatus, BrokerPositionInfo } from './types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { Order, Fill, Position, OrderStatus } from '../../execution/types'

export class BrokerEventAdapter {
  private adapter: BrokerAdapter
  private eventBus?: ExecutionEventBus
  private unsubscribers: Array<() => void> = []

  constructor(adapter: BrokerAdapter) {
    this.adapter = adapter
  }

  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus
  }

  /** Subscribe to all relevant broker events */
  subscribe(): void {
    const unsub1 = this.adapter.on('order', (event: BrokerEvent) => this.onOrderEvent(event))
    const unsub2 = this.adapter.on('fill', (event: BrokerEvent) => this.onFillEvent(event))
    const unsub3 = this.adapter.on('position', (event: BrokerEvent) => this.onPositionEvent(event))
    const unsub4 = this.adapter.on('error', (event: BrokerEvent) => this.onErrorEvent(event))

    this.unsubscribers.push(unsub1, unsub2, unsub3, unsub4)
  }

  /** Unsubscribe from broker events */
  unsubscribe(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
  }

  // ── Event Handlers ──

  private onOrderEvent(event: BrokerEvent): void {
    const status = event.data as BrokerOrderStatus
    if (!this.eventBus) return

    const order: Order = {
      id: status.clientOrderId ?? status.brokerOrderId,
      strategyId: '',
      symbol: status.symbol,
      side: status.side === 'buy' ? 'buy' : 'sell',
      type: this.mapType(status.type),
      quantity: status.quantity,
      filledQuantity: status.filledQuantity,
      averagePrice: status.averagePrice,
      price: status.price,
      stopPrice: undefined,
      status: this.mapStatus(status.status) as OrderStatus,
      commission: status.commission,
      timeInForce: 'GTC',
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    }

    switch (status.status) {
      case 'NEW':
        this.eventBus.emit({ type: 'ORDER_ACCEPTED', order, timestamp: event.timestamp })
        break
      case 'CANCELLED':
      case 'EXPIRED':
        this.eventBus.emit({ type: 'ORDER_CANCELLED', order, timestamp: event.timestamp })
        break
      case 'REJECTED':
        this.eventBus.emit({ type: 'ORDER_REJECTED', order, reason: 'Broker rejected', timestamp: event.timestamp })
        break
    }
  }

  private onFillEvent(event: BrokerEvent): void {
    const fillData = event.data as {
      order: BrokerOrderStatus
      quantity: number
      price: number
      commission: number
    }
    if (!this.eventBus) return

    const order: Order = {
      id: fillData.order.clientOrderId ?? fillData.order.brokerOrderId,
      strategyId: '',
      symbol: fillData.order.symbol,
      side: fillData.order.side === 'buy' ? 'buy' : 'sell',
      type: this.mapType(fillData.order.type),
      quantity: fillData.order.quantity,
      filledQuantity: fillData.order.filledQuantity,
      averagePrice: fillData.order.averagePrice,
      price: fillData.order.price,
      stopPrice: undefined,
      status: this.mapStatus(fillData.order.status) as OrderStatus,
      commission: fillData.order.commission,
      timeInForce: 'GTC',
      createdAt: fillData.order.createdAt,
      updatedAt: fillData.order.updatedAt,
    }

    const fill: Fill = {
      id: `fill_${event.timestamp}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: fillData.quantity,
      price: fillData.price,
      commission: fillData.commission ?? 0,
      commissionAsset: '',
      slippage: 0,
      timestamp: event.timestamp,
    }

    this.eventBus.emit({ type: 'ORDER_FILLED', order, fill, timestamp: event.timestamp })
  }

  private onPositionEvent(event: BrokerEvent): void {
    const pos = event.data as BrokerPositionInfo
    if (!this.eventBus) return

    const position: Position = {
      symbol: pos.symbol,
      direction: pos.direction,
      quantity: pos.quantity,
      averageEntryPrice: pos.averageEntryPrice,
      currentPrice: pos.currentPrice,
      unrealizedPnl: pos.unrealizedPnl,
      realizedPnl: pos.realizedPnl,
      openedAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.eventBus.emit({ type: 'POSITION_UPDATED', position, timestamp: event.timestamp })
  }

  private onErrorEvent(_event: BrokerEvent): void {
    // Error events are handled by LiveProvider
  }

  private mapType(brokerType: string): 'market' | 'limit' | 'stop' | 'stop_limit' {
    const t = brokerType.toUpperCase()
    if (t === 'MARKET') return 'market'
    if (t === 'LIMIT') return 'limit'
    if (t === 'STOP' || t === 'STOP_LOSS') return 'stop'
    if (t === 'STOP_LOSS_LIMIT') return 'stop_limit'
    return 'limit'
  }

  private mapStatus(brokerStatus: string): string {
    switch (brokerStatus) {
      case 'NEW': return 'pending'
      case 'PARTIALLY_FILLED': return 'partially_filled'
      case 'FILLED': return 'filled'
      case 'CANCELLED': case 'CANCELED': return 'cancelled'
      case 'EXPIRED': return 'expired'
      case 'REJECTED': return 'rejected'
      default: return 'pending'
    }
  }

  dispose(): void {
    this.unsubscribe()
    this.eventBus = undefined
  }
}
