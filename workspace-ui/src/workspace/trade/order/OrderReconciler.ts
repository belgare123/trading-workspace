// ── OrderReconciler — reconnect → exchange.getOpenOrders → merge ──

import { Order } from '../Order'
import { BrokerOrderStatus } from '../types'
import type { OrderTracker } from './OrderTracker'
import { OrderTrackerState } from './types'

/** A remote order from the exchange */
export interface RemoteOrder {
  brokerOrderId: string
  clientOrderId?: string
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  filledQuantity: number
  price?: number
  averagePrice: number
  status: string
}

/** Result of a reconciliation pass */
export interface ReconciliationResult {
  matched: number
  mismatched: number
  orphansFound: number
  orphansResolved: number
  updates: Array<{
    orderId: string
    field: string
    localValue: unknown
    remoteValue: unknown
  }>
}

export interface IReconcileGateway {
  getOpenOrders(symbol?: string): Promise<RemoteOrder[]>
}

export class OrderReconciler {
  private gateway: IReconcileGateway
  private tracker: OrderTracker

  constructor(gateway: IReconcileGateway, tracker: OrderTracker) {
    this.gateway = gateway
    this.tracker = tracker
  }

  /**
   * Run reconciliation after reconnect.
   * Fetches open orders from exchange and merges with local state.
   */
  async reconcile(symbol?: string): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      matched: 0,
      mismatched: 0,
      orphansFound: 0,
      orphansResolved: 0,
      updates: [],
    }

    // 1. Fetch remote open orders
    const remoteOrders = await this.gateway.getOpenOrders(symbol)
    const remoteByClientId = new Map<string, RemoteOrder>()
    for (const ro of remoteOrders) {
      if (ro.clientOrderId) {
        remoteByClientId.set(ro.clientOrderId, ro)
      }
    }

    // 2. Get local active orders
    const localOrders = this.tracker.getByState(
      OrderTrackerState.Working,
      OrderTrackerState.PendingCancel,
      OrderTrackerState.Replacing,
    )

    // 3. Match local → remote
    for (const local of localOrders) {
      const remote = remoteByClientId.get(local.id)
      if (!remote) {
        // Order exists locally but not on exchange (orphan)
        result.orphansFound++
        if (local.status === BrokerOrderStatus.Working || local.status === BrokerOrderStatus.New) {
          // Consider it cancelled/filled on exchange side
          this.tracker.transition(local.id, OrderTrackerState.Completed)
          result.orphansResolved++
          result.updates.push({
            orderId: local.id,
            field: 'status',
            localValue: local.status,
            remoteValue: 'not_found',
          })
        }
        continue
      }

      // Order found on exchange — check for status changes
      result.matched++
      const remoteStatus = this.mapRemoteStatus(remote.status)

      if (this.shouldUpdate(local, remote, remoteStatus)) {
        result.mismatched++

        // Update Order model
        const updatedFilled = {
          ...local,
          filledQuantity: remote.filledQuantity,
          averagePrice: remote.averagePrice,
          status: remoteStatus,
          updatedAt: Date.now(),
        }

        this.tracker.updateOrder(updatedFilled as Order)

        // If remote is terminal, update tracker state
        if (remoteStatus === BrokerOrderStatus.Filled || remoteStatus === BrokerOrderStatus.Cancelled || remoteStatus === BrokerOrderStatus.Expired) {
          this.tracker.transition(local.id, OrderTrackerState.Completed)
        }

        result.updates.push({
          orderId: local.id,
          field: 'status',
          localValue: local.status,
          remoteValue: remoteStatus,
        })
      }
    }

    return result
  }

  private mapRemoteStatus(remoteStatus: string): string {
    switch (remoteStatus.toUpperCase()) {
      case 'NEW': return BrokerOrderStatus.New
      case 'PARTIALLY_FILLED': return BrokerOrderStatus.PartiallyFilled
      case 'FILLED': return BrokerOrderStatus.Filled
      case 'CANCELLED':
      case 'CANCELED': return BrokerOrderStatus.Cancelled
      case 'EXPIRED': return BrokerOrderStatus.Expired
      case 'REJECTED': return BrokerOrderStatus.Rejected
      default: return remoteStatus
    }
  }

  private shouldUpdate(local: Order, remote: RemoteOrder, remoteStatus: string): boolean {
    return (
      local.status !== remoteStatus ||
      local.filledQuantity !== remote.filledQuantity ||
      local.averagePrice !== remote.averagePrice
    )
  }
}
