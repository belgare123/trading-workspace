/**
 * OrderStateReconciler.ts — Compares local order/position/balance state
 * with broker snapshots and emits correction events for any drift.
 *
 * Flow:
 *   fetchBrokerSnapshot() → compareWithLocalState()
 *     → detectMissingOrders()    (local has, broker doesn't → locally close)
 *     → detectUnknownOrders()    (broker has, local doesn't → import)
 *     → detectStateMismatches()  (status/quantity/fill drift)
 *     → detectPositionMismatches()
 *     → detectBalanceMismatches()
 *     → emit reconciliation events
 *
 * @since 4.6.2
 */

import type { BrokerAdapter } from './BrokerAdapter'
import type { BrokerOrder, BrokerPosition, BrokerBalance } from './types'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import {
  OrderStatus,
  type Order,
  type Position,
} from '../../execution/types'

// ── Reconciliation Result Types ──

export type ReconciliationSeverity = 'info' | 'warning' | 'error'

export interface ReconciliationIssue {
  type: 'missing_order' | 'unknown_order' | 'state_mismatch' | 'position_mismatch' | 'balance_mismatch'
  severity: ReconciliationSeverity
  symbol?: string
  localValue?: string
  brokerValue?: string
  detail: string
  orderId?: string
}

export interface ReconciliationResult {
  issues: ReconciliationIssue[]
  orderCount: number       // Orders in reconciliation scope
  positionCount: number    // Positions checked
  startTime: number
  endTime: number
  durationMs: number
}

// ── Reconciliation Source ──

export interface LocalStateProvider {
  getOrders: () => Order[]
  getPositions: () => Position[]
  getBalances: () => Record<string, { asset: string; free: number; locked: number }>
}

// ── OrderStateReconciler ──

export class OrderStateReconciler {
  private adapter: BrokerAdapter
  private localState: LocalStateProvider
  private eventBus?: ExecutionEventBus
  private strictMode: boolean = false
  private lastResult?: ReconciliationResult

  constructor(
    adapter: BrokerAdapter,
    localState: LocalStateProvider,
    options?: { strictMode?: boolean; eventBus?: ExecutionEventBus },
  ) {
    this.adapter = adapter
    this.localState = localState
    if (options?.strictMode) this.strictMode = true
    if (options?.eventBus) this.eventBus = options.eventBus
  }

  setEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus
  }

  setLocalState(provider: LocalStateProvider): void {
    this.localState = provider
  }

  /** Run full reconciliation cycle */
  async reconcile(): Promise<ReconciliationResult> {
    const startTime = Date.now()
    const issues: ReconciliationIssue[] = []

    // 1. Fetch broker snapshot
    const [brokerOrders, brokerPositions, brokerBalances] = await this.fetchBrokerSnapshot()

    // 2. Get local state
    const localOrders = this.localState.getOrders()
    const localPositions = this.localState.getPositions()
    const localBalances = this.localState.getBalances()

    // 3. Detect order mismatches
    this.detectMissingOrders(localOrders, brokerOrders, issues)
    this.detectUnknownOrders(localOrders, brokerOrders, issues)
    this.detectStateMismatches(localOrders, brokerOrders, issues)

    // 4. Detect position mismatches
    this.detectPositionMismatches(localPositions, brokerPositions, issues)

    // 5. Detect balance mismatches
    this.detectBalanceMismatches(localBalances, brokerBalances, issues)

    const endTime = Date.now()
    const result: ReconciliationResult = {
      issues,
      orderCount: Math.max(localOrders.length, brokerOrders.length),
      positionCount: Math.max(localPositions.length, brokerPositions.length),
      startTime,
      endTime,
      durationMs: endTime - startTime,
    }

    this.lastResult = result
    return result
  }

  /** Get the last reconciliation result */
  get lastReconciliation(): ReconciliationResult | undefined {
    return this.lastResult
  }

  /** Check if the last reconciliation had any issues */
  get hasIssues(): boolean {
    return this.lastResult !== undefined && this.lastResult.issues.length > 0
  }

  /** Count of issues by severity */
  get issueCount(): { info: number; warning: number; error: number } {
    const counts = { info: 0, warning: 0, error: 0 }
    this.lastResult?.issues.forEach(i => counts[i.severity]++)
    return counts
  }

  // ── Private ──

  private async fetchBrokerSnapshot(): Promise<[BrokerOrder[], BrokerPosition[], Record<string, BrokerBalance>]> {
    let orders: BrokerOrder[] = []
    let positions: BrokerPosition[] = []
    let balances: Record<string, BrokerBalance> = {}

    try {
      orders = await this.adapter.orders.getOpenOrders()
    } catch {
      // If broker adapter doesn't support this, return empty
    }

    try {
      positions = await this.adapter.positions.getPositions()
    } catch {
      // Non-fatal
    }

    // 3. Fetch balances from broker
    try {
      const info = await this.adapter.account.getBalances()
      if (info) {
        for (const [asset, bal] of Object.entries(info)) {
          balances[asset] = bal
        }
      }
    } catch {
      // Non-fatal
    }

    return [orders, positions, balances]
  }

  /** Detect orders that exist locally but not on the broker */
  private detectMissingOrders(
    localOrders: Order[],
    brokerOrders: BrokerOrder[],
    issues: ReconciliationIssue[],
  ): void {
    const brokerOrderIds = new Set(brokerOrders.map(o => o.brokerOrderId))
    const brokerClientIds = new Set(brokerOrders.map(o => o.clientOrderId).filter(Boolean))

    for (const local of localOrders) {
      // Skip terminal states
      if (local.status === OrderStatus.FILLED ||
          local.status === OrderStatus.CANCELLED ||
          local.status === OrderStatus.REJECTED ||
          local.status === OrderStatus.EXPIRED) {
        continue
      }

      const isOnBroker = (local.id && brokerOrderIds.has(local.id)) ||
                         (local.clientId && brokerClientIds.has(local.clientId))

      if (!isOnBroker) {
        const issue: ReconciliationIssue = {
          type: 'missing_order',
          severity: 'error',
          symbol: local.symbol,
          detail: `Order ${local.id} (${local.status}) not found on broker — may have been filled/cancelled externally`,
          orderId: local.id,
        }

        issues.push(issue)
        this.emitOrderEvent(local, 'ORDER_CANCELLED', 'Order not found on broker')
      }
    }
  }

  /** Detect orders that exist on the broker but not locally */
  private detectUnknownOrders(
    localOrders: Order[],
    brokerOrders: BrokerOrder[],
    issues: ReconciliationIssue[],
  ): void {
    const localIds = new Set(localOrders.map(o => o.id))
    const localClientIds = new Set(localOrders.map(o => o.clientId).filter(Boolean))

    for (const broker of brokerOrders) {
      const isLocal = (broker.brokerOrderId && localIds.has(broker.brokerOrderId)) ||
                      (broker.clientOrderId && localClientIds.has(broker.clientOrderId))

      if (!isLocal) {
        issues.push({
          type: 'unknown_order',
          severity: 'warning',
          symbol: broker.symbol,
          detail: `Unknown order on broker: ${broker.brokerOrderId} (${broker.status}) — not in local state`,
          orderId: broker.brokerOrderId,
        })

        // In strict mode, emit a fill/cancel for unknown orders
        if (this.strictMode) {
          this.emitUnknownOrderCorrection(broker)
        }
      }
    }
  }

  /** Detect status/quantity/fill mismatches between local and broker */
  private detectStateMismatches(
    localOrders: Order[],
    brokerOrders: BrokerOrder[],
    issues: ReconciliationIssue[],
  ): void {
    const brokerByClientId = new Map<string, BrokerOrder>()
    const brokerByOrderId = new Map<string, BrokerOrder>()

    for (const bo of brokerOrders) {
      if (bo.clientOrderId) brokerByClientId.set(bo.clientOrderId, bo)
      if (bo.brokerOrderId) brokerByOrderId.set(bo.brokerOrderId, bo)
    }

    for (const local of localOrders) {
      const broker = brokerByClientId.get(local.clientId ?? '') ?? brokerByOrderId.get(local.id)

      if (!broker) continue

      // Check filled quantity drift
      const localFilled = local.filledQuantity ?? 0
      const brokerFilled = broker.filledQuantity ?? 0
      const fillDiff = Math.abs(brokerFilled - localFilled)

      if (fillDiff > 0) {
        issues.push({
          type: 'state_mismatch',
          severity: fillDiff > 0.0001 ? 'error' : 'warning',
          symbol: local.symbol,
          localValue: `filled=${localFilled}`,
          brokerValue: `filled=${brokerFilled}`,
          detail: `Filled quantity mismatch for ${local.id}: local=${localFilled}, broker=${brokerFilled}`,
          orderId: local.id,
        })

        // Emit fill correction event for the difference
        if (fillDiff > 0.0001) {
          this.emitFillCorrection(local, broker, fillDiff, brokerFilled - localFilled)
        }
      }

      // Check status drift
      if (this.areStatusesEquivalent(local.status, broker.status)) continue

      issues.push({
        type: 'state_mismatch',
        severity: 'warning',
        symbol: local.symbol,
        localValue: local.status,
        brokerValue: broker.status,
        detail: `Status mismatch for ${local.id}: local=${local.status}, broker=${broker.status}`,
        orderId: local.id,
      })

      // Emit status correction
      this.emitStatusCorrection(local, broker)
    }
  }

  /** Detect position mismatches between local state and broker snapshot + emit events */
  private detectPositionMismatches(
    localPositions: Position[],
    brokerPositions: BrokerPosition[],
    issues: ReconciliationIssue[],
  ): void {
    const localBySymbol = new Map<string, Position>()
    for (const p of localPositions) {
      localBySymbol.set(p.symbol, p)
    }

    const brokerBySymbol = new Map<string, BrokerPosition>()
    for (const p of brokerPositions) {
      brokerBySymbol.set(p.symbol, p)
    }

    // Positions on broker but not locally → emit POSITION_OPENED
    for (const [symbol, bp] of brokerBySymbol) {
      const local = localBySymbol.get(symbol)
      if (!local && bp.quantity > 0) {
        issues.push({
          type: 'position_mismatch',
          severity: 'warning',
          symbol,
          localValue: 'qty=0',
          brokerValue: `qty=${bp.quantity}, dir=${bp.direction}`,
          detail: `Position ${symbol} opened on broker while offline: qty=${bp.quantity}, dir=${bp.direction}`,
        })

        if (this.eventBus) {
          this.eventBus.emit({
            type: 'POSITION_OPENED',
            position: this.brokerPositionToPos(bp, symbol),
            timestamp: Date.now(),
          })
        }
      } else if (local && Math.abs(local.quantity - bp.quantity) > 0.0001) {
        issues.push({
          type: 'position_mismatch',
          severity: local.quantity === 0 ? 'error' : 'warning',
          symbol,
          localValue: `qty=${local.quantity}`,
          brokerValue: `qty=${bp.quantity}`,
          detail: `Position quantity mismatch for ${symbol}: local=${local.quantity}, broker=${bp.quantity}`,
        })

        if (this.eventBus && bp.quantity === 0 && local.quantity > 0) {
          // Position closed on broker
          this.eventBus.emit({
            type: 'POSITION_CLOSED',
            position: local,
            realizedPnl: bp.realizedPnl ?? 0,
            timestamp: Date.now(),
          })
        }
      }
    }

    // Positions locally but not on broker → emit POSITION_CLOSED
    for (const [symbol, lp] of localBySymbol) {
      if (!brokerBySymbol.has(symbol) && lp.quantity > 0) {
        issues.push({
          type: 'position_mismatch',
          severity: 'warning',
          symbol,
          localValue: `qty=${lp.quantity}`,
          brokerValue: 'qty=0',
          detail: `Position ${symbol} closed on broker while offline`,
        })

        if (this.eventBus) {
          this.eventBus.emit({
            type: 'POSITION_CLOSED',
            position: lp,
            realizedPnl: 0,
            timestamp: Date.now(),
          })
        }
      }
    }
  }

  /** Convert BrokerPosition to Position for event emission */
  private brokerPositionToPos(bp: BrokerPosition, symbol: string): Position {
    return {
      symbol,
      direction: bp.direction,
      quantity: bp.quantity,
      averageEntryPrice: bp.averageEntryPrice,
      currentPrice: bp.currentPrice,
      unrealizedPnl: bp.unrealizedPnl,
      realizedPnl: bp.realizedPnl,
      openedAt: bp.updatedAt - 1000,
      updatedAt: bp.updatedAt,
    }
  }

  /** Detect significant balance discrepancies */
  private detectBalanceMismatches(
    localBalances: Record<string, { asset: string; free: number; locked: number }> | undefined,
    brokerBalances: Record<string, BrokerBalance> | undefined,
    issues: ReconciliationIssue[],
  ): void {
    if (!brokerBalances || !localBalances) return
    for (const [asset, broker] of Object.entries(brokerBalances)) {
      const local = localBalances[asset]
      if (!local) {
        issues.push({
          type: 'balance_mismatch',
          severity: 'info',
          detail: `Balance for ${asset} exists on broker (${broker.free}) but not tracked locally`,
        })
        continue
      }

      const totalDiff = Math.abs((local.free + local.locked) - broker.total)
      if (totalDiff > 1.0) {
        issues.push({
          type: 'balance_mismatch',
          severity: 'warning',
          localValue: `total=${local.free + local.locked}`,
          brokerValue: `total=${broker.total}`,
          detail: `Balance mismatch for ${asset}: local=${local.free + local.locked}, broker=${broker.total}`,
        })
      }
    }
  }

  /** Check if two statuses represent semantically equivalent states */
  private areStatusesEquivalent(local: string, broker: string): boolean {
    const norm = (s: string): string => s.toLowerCase().replace(/[_-]/g, '')
    return norm(local) === norm(broker)
  }

  /** Emit a fill correction event for a discovered fill mismatch */
  private emitFillCorrection(local: Order, broker: BrokerOrder, diff: number, direction: number): void {
    if (!this.eventBus) return
    this.eventBus.emit({
      type: 'ORDER_PARTIALLY_FILLED',
      order: {
        ...local,
        filledQuantity: Math.min(local.filledQuantity + Math.abs(direction), local.quantity),
        status: OrderStatus.PARTIALLY_FILLED,
      },
      fill: {
        id: `recon-${Date.now()}-${local.id}`,
        orderId: local.id,
        symbol: local.symbol,
        side: local.side,
        quantity: Math.abs(diff),
        price: broker.averagePrice || local.averagePrice || 0,
        commission: 0,
        commissionAsset: '',
        slippage: 0,
        timestamp: Date.now(),
      },
      remainingQuantity: local.quantity - (local.filledQuantity + Math.abs(diff)),
      timestamp: Date.now(),
    })
  }

  /** Emit a status correction for a discovered status drift */
  private emitStatusCorrection(local: Order, broker: BrokerOrder): void {
    if (!this.eventBus) return
    const status = broker.status.toLowerCase() as Order['status']

    if (status === OrderStatus.FILLED) {
      this.eventBus.emit({
        type: 'ORDER_FILLED',
        order: { ...local, status: OrderStatus.FILLED, filledQuantity: local.quantity },
        fill: {
          id: `recon-${Date.now()}-fill-${local.id}`,
          orderId: local.id,
          symbol: local.symbol,
          side: local.side,
          quantity: local.quantity - local.filledQuantity,
          price: broker.averagePrice || local.averagePrice || 0,
          commission: 0,
          commissionAsset: '',
          slippage: 0,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      })
    } else if (status === OrderStatus.CANCELLED) {
      this.eventBus.emit({
        type: 'ORDER_CANCELLED',
        order: { ...local, status: OrderStatus.CANCELLED },
        timestamp: Date.now(),
      })
    }
  }

  /** Emit order event when an order is missing on the broker side */
  private emitOrderEvent(local: Order, eventType: 'ORDER_CANCELLED', reason: string): void {
    if (!this.eventBus) return
    if (eventType === 'ORDER_CANCELLED') {
      this.eventBus.emit({
        type: 'ORDER_CANCELLED',
        order: { ...local, status: OrderStatus.CANCELLED, rejectReason: reason },
        timestamp: Date.now(),
      })
    }
  }

  private emitUnknownOrderCorrection(_broker: BrokerOrder): void {
    // In strict mode, we could import the unknown order into local state.
    // Currently handled by detection-only in normal mode.
  }
}
