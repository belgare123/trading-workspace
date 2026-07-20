/**
 * ExecutionRecoveryRuntime.ts — Recovery after restart or network loss
 *
 * Coordinates state restoration using BrokerAdapter, OrderStateReconciler,
 * and the connected LiveProvider sub-components.
 *
 * Recovery Flow:
 *   1. Detect disconnection → wait for reconnection
 *   2. Fetch broker state (open orders, positions, balances)
 *   3. Reconcile with local state via OrderStateReconciler
 *   4. Resubmit pending orders that were lost (if configured)
 *   5. Emit recovery events with full report
 *
 * @since 4.6.6
 */

import type { BrokerAdapter } from './BrokerAdapter'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { OrderStateReconciler, ReconciliationResult } from './OrderStateReconciler'

// ── Recovery Types ──

export type RecoveryMode = 'restore' | 'validate' | 'repair'

export type RecoveryPhase =
  | 'idle'
  | 'awaiting_connection'
  | 'fetching_broker_state'
  | 'reconciling'
  | 'resubmitting'
  | 'complete'
  | 'failed'

export interface RecoveryConfig {
  /** Recovery mode: restore (default), validate, repair */
  mode: RecoveryMode
  /** Whether to resubmit pending orders that were lost during disconnect */
  resubmitPending: boolean
  /** Max orders to resubmit in a single recovery cycle */
  maxResubmit: number
  /** Delay (ms) between resubmit attempts */
  resubmitDelayMs: number
  /** Whether to restore positions (no-op in validate mode) */
  restorePositions: boolean
  /** Auto-run recovery when session transitions to CONNECTED */
  autoRecovery: boolean
}

export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  mode: 'restore',
  resubmitPending: true,
  maxResubmit: 10,
  resubmitDelayMs: 500,
  restorePositions: true,
  autoRecovery: true,
}

export interface RecoveryReport {
  config: RecoveryConfig
  phase: RecoveryPhase
  startTime: number
  endTime?: number
  durationMs?: number
  success: boolean
  error?: string
  reconciliation?: ReconciliationResult
  resubmittedCount: number
  openOrdersFound: number
  openPositionsFound: number
}

// ── Recovery Events ──

export interface RecoveryEvent {
  type: 'RECOVERY_STARTED' | 'RECOVERY_COMPLETE' | 'RECOVERY_FAILED'
    | 'RECOVERY_PENDING_ORDERS_FOUND' | 'RECOVERY_ORDER_RESUBMITTED'
    | 'RECOVERY_ORDER_RESUBMIT_FAILED'
  timestamp: number
  detail: string
}

// ── ExecutionRecoveryRuntime ──

export class ExecutionRecoveryRuntime {
  private adapter: BrokerAdapter
  private reconciler: OrderStateReconciler
  private eventBus?: ExecutionEventBus
  private config: RecoveryConfig
  private phase: RecoveryPhase = 'idle'
  private localStateProvider?: import('./OrderStateReconciler').LocalStateProvider

  constructor(
    adapter: BrokerAdapter,
    reconciler: OrderStateReconciler,
    config?: Partial<RecoveryConfig>,
    eventBus?: ExecutionEventBus,
  ) {
    this.adapter = adapter
    this.reconciler = reconciler
    this.eventBus = eventBus
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config }
  }

  // ── Public API ──

  /** Set the local state provider so reconciler can compare */
  setLocalState(provider: import('./OrderStateReconciler').LocalStateProvider): void {
    this.localStateProvider = provider
  }

  /** Get current recovery phase */
  getPhase(): RecoveryPhase {
    return this.phase
  }

  /** Whether recovery is currently in progress */
  get isRunning(): boolean {
    return this.phase !== 'idle' && this.phase !== 'complete' && this.phase !== 'failed'
  }

  /**
   * Run full recovery cycle.
   * Can be called manually or triggered automatically after reconnect.
   */
  async recover(): Promise<RecoveryReport> {
    const report: RecoveryReport = {
      config: { ...this.config },
      phase: 'fetching_broker_state',
      startTime: Date.now(),
      success: false,
      resubmittedCount: 0,
      openOrdersFound: 0,
      openPositionsFound: 0,
    }

    try {
      this.phase = 'fetching_broker_state'
      this.emitEvent('RECOVERY_STARTED', 'Starting execution recovery cycle')

      // 1. Fetch broker state
      const [openOrders, openPositions] = await Promise.all([
        this.adapter.orders.getOpenOrders(),
        this.adapter.positions.getPositions(),
      ])

      report.openOrdersFound = openOrders.length
      report.openPositionsFound = openPositions.length

      // 2. Reconcile orders if we have a local state provider
      this.phase = 'reconciling'

      if (this.localStateProvider) {
        this.reconciler.setLocalState(this.localStateProvider)
        const reconciles = await this.reconciler.reconcile()
        report.reconciliation = reconciles
      }

      // 3. Resubmit pending orders if configured
      if (this.config.resubmitPending && this.config.mode === 'restore') {
        this.phase = 'resubmitting'
        report.resubmittedCount = await this.resubmitPendingOrders()
      }

      // 4. Complete
      this.phase = 'complete'
      report.success = true
      report.endTime = Date.now()
      report.durationMs = report.endTime - report.startTime

      this.emitEvent('RECOVERY_COMPLETE', `Recovery complete: ${report.resubmittedCount} orders resubmitted, ${report.openOrdersFound} open orders found`)

      return report
    } catch (err) {
      this.phase = 'failed'
      report.success = false
      report.error = (err as Error).message ?? String(err)
      report.endTime = Date.now()
      report.durationMs = report.endTime - report.startTime

      this.emitEvent('RECOVERY_FAILED', `Recovery failed: ${report.error}`)

      return report
    }
  }

  /**
   * Wait for connection and then run recovery.
   * Polls the adapter's connection state every 1s.
   */
  async recoverAfterReconnect(maxWaitMs = 60_000): Promise<RecoveryReport> {
    this.phase = 'awaiting_connection'
    this.emitEvent('RECOVERY_STARTED', 'Awaiting broker connection before recovery')

    const deadline = Date.now() + maxWaitMs

    while (Date.now() < deadline) {
      if (this.adapter.connection.isConnected()) {
        return this.recover()
      }
      await new Promise(resolve => setTimeout(resolve, 1_000))
    }

    throw new Error(
      `ExecutionRecoveryRuntime: broker did not reconnect within ${maxWaitMs}ms`,
    )
  }

  /** Reset recovery state */
  reset(): void {
    this.phase = 'idle'
  }

  // ── Internals ──

  /**
   * Attempt to resubmit any local orders that may have been lost.
   * Only works if a local state provider is set.
   */
  private async resubmitPendingOrders(): Promise<number> {
    if (!this.localStateProvider) return 0

    const localOrders = this.localStateProvider.getOrders()
    const pending = localOrders.filter(o =>
      o.status === 'pending' || o.status === 'accepted' || o.status === 'partially_filled',
    )

    if (pending.length === 0) return 0

    this.emitEvent(
      'RECOVERY_PENDING_ORDERS_FOUND',
      `${pending.length} pending orders found, attempting resubmit (max ${this.config.maxResubmit})`,
    )

    let resubmitted = 0

    for (const order of pending.slice(0, this.config.maxResubmit)) {
      try {
        // Check if already on broker
        if (order.id) {
          const existing = await this.adapter.orders.getOrder(order.id, order.symbol)
          if (existing && existing.status !== 'CANCELLED' && existing.status !== 'REJECTED') {
            continue // still alive on broker
          }
        }

        // Resubmit
        await this.adapter.orders.placeOrder({
          symbol: order.symbol,
          side: order.side as 'buy' | 'sell',
          type: order.type === 'market' ? 'MARKET'
            : order.type === 'limit' ? 'LIMIT'
            : order.type === 'stop' ? 'STOP_LOSS'
            : 'LIMIT',
          quantity: order.quantity,
          price: order.price,
          stopPrice: order.stopPrice,
          timeInForce: order.timeInForce,
          reduceOnly: order.reduceOnly,
          clientOrderId: `recover_${order.id}_${Date.now()}`,
        })

        resubmitted++

        this.emitEvent('RECOVERY_ORDER_RESUBMITTED', `Order ${order.id} resubmitted`)

        // Throttle between resubmits
        if (resubmitted < this.config.maxResubmit) {
          await new Promise(resolve => setTimeout(resolve, this.config.resubmitDelayMs))
        }
      } catch (err) {
        this.emitEvent(
          'RECOVERY_ORDER_RESUBMIT_FAILED',
          `Failed to resubmit order ${order.id}: ${(err as Error).message}`,
        )
      }
    }

    return resubmitted
  }

  private emitEvent(type: RecoveryEvent['type'], detail: string): void {
    if (!this.eventBus) return

    this.eventBus.emit({
      type,
      timestamp: Date.now(),
      detail,
    } as unknown as import('../../execution/events/ExecutionEvents').ExecutionEvent)
  }
}
