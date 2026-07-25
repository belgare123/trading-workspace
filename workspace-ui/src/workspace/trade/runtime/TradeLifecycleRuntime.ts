// ── TradeLifecycleRuntime — единственный владелец Trade ──

import { Trade, type TradeId } from '../Trade'
import { TradeStatus, type Fill, BrokerOrderStatus } from '../types'
import { TradeEventType } from '../TradeLifecycleEvent'
import type { MarketSnapshot } from '../../execution/types'

import { EntryController } from './EntryController'
import { ManageController } from './ManageController'
import { ExitController } from './ExitController'
import { RecoveryController } from './RecoveryController'
import { LifecycleEventBus } from './LifecycleEventBus'
import type {
  TradeSignal,
  IOrderManager,
  IExitEngine,
  IRecoveryGateway,
  OrderEvent,
  ExitDecision,
} from './interfaces'

import { createTradeLifecycleEvent } from './event-factory'

// ════════════════════════════════════════
// Runtime Options
// ════════════════════════════════════════

export interface TradeLifecycleOptions {
  orderManager: IOrderManager
  exitEngine: IExitEngine
  gateway?: IRecoveryGateway
  walletSnapshot?: () => { total: number; free: number; reserved: number }
}

// ════════════════════════════════════════
// TradeLifecycleRuntime
// ════════════════════════════════════════

export class TradeLifecycleRuntime {
  // Controllers
  private readonly entryController: EntryController
  private readonly manageController: ManageController
  private readonly exitController: ExitController
  private readonly recoveryController: RecoveryController

  // Infrastructure
  readonly eventBus: LifecycleEventBus
  private readonly orderManager: IOrderManager
  private readonly exitEngine: IExitEngine
  private readonly gateway?: IRecoveryGateway
  private readonly walletSnapshot?: () => { total: number; free: number; reserved: number }

  // State
  private readonly trades = new Map<TradeId, Trade>()
  private readonly orderToTrade = new Map<string, TradeId>()  // orderId → tradeId
  private isShutdown = false
  private unsubscribeOrderManager?: () => void

  constructor(options: TradeLifecycleOptions) {
    this.orderManager = options.orderManager
    this.exitEngine = options.exitEngine
    this.gateway = options.gateway
    this.walletSnapshot = options.walletSnapshot

    this.entryController = new EntryController()
    this.manageController = new ManageController()
    this.exitController = new ExitController()
    this.recoveryController = new RecoveryController()
    this.eventBus = new LifecycleEventBus()

    // Subscribe to OrderManager events via event bus
    this.unsubscribeOrderManager = this.orderManager.on('*', (event) => this.onOrderEvent(event))
  }

  // ══════════════════════════════════════
  // Public API
  // ══════════════════════════════════════

  async open(signal: TradeSignal): Promise<Trade> {
    this.assertNotShutdown()

    const trade = await this.entryController.open(signal, this.orderManager)
    this.registerTrade(trade)

    // Map the entry order
    if (trade.orderIds.length > 0) {
      this.orderToTrade.set(trade.orderIds[trade.orderIds.length - 1], trade.id)
    }

    // Emit lifecycle events
    this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeOpened))
    if (trade.status === TradeStatus.Rejected) {
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeRejected))
    }

    return trade
  }

  /** OrderManager event bus callback */
  private onOrderEvent(event: OrderEvent): void {
    if (this.isShutdown) return

    const trade = this.findTradeByOrderId(event.order.id)
    if (!trade) return

    switch (event.type) {
      case 'OrderWorking':
      case 'OrderAccepted':
        this.handleOrderAccepted(trade)
        break
      case 'OrderPartial':
        if (event.fill) {
          this.handlePartialFill(trade, event.fill)
        }
        break
      case 'OrderFilled':
        if (event.fill) {
          this.handleFilled(trade, event.fill)
        } else {
          this.handleFilled(trade)
        }
        break
      case 'OrderCancelled':
        this.handleCancelled(trade)
        break
      case 'OrderRejected':
        this.handleRejected(trade, event.reason ?? 'rejected')
        break
      case 'OrderExpired':
        this.handleExpired(trade)
        break
      case 'OrderReplaced':
        // Map the new order ID for the same trade
        this.orderToTrade.set(event.order.id, trade.id)
        break
    }
  }

  /** Process a market tick — PnL update + ExitEngine evaluation */
  onMarketTick(market: MarketSnapshot): void {
    if (this.isShutdown) return

    const activeTrades = this.getManagingTrades(market.symbol)
    if (activeTrades.length === 0) return

    const wallet = this.walletSnapshot
      ? this.walletSnapshot()
      : { total: 10000, free: 5000, reserved: 0 }

    const decisions = this.manageController.onMarketTick(
      activeTrades,
      market,
      this.exitEngine,
      wallet,
    )

    // Fire exit decisions asynchronously
    for (const [tradeId, decision] of decisions) {
      const trade = this.trades.get(tradeId)
      if (trade) {
        this.triggerExit(trade, decision).catch(err => {
          trade.markErrored(`exit failed: ${err instanceof Error ? err.message : String(err)}`)
          this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeErrored))
        })
      }
    }
  }

  /** Manual close of a managing trade */
  async requestClose(tradeId: string, reason?: string): Promise<void> {
    this.assertNotShutdown()
    const trade = this.trades.get(tradeId)
    if (!trade || trade.isTerminal) return

    await this.exitController.requestClose(trade, reason ?? 'manual', this.orderManager)
    this.mapLastOrderId(trade)
    this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeExitPending))
  }

  updateStopLoss(tradeId: string, price: number): void {
    const trade = this.trades.get(tradeId)
    if (!trade) return
    this.manageController.updateStopLoss(trade, price)
  }

  updateTakeProfit(tradeId: string, price: number): void {
    const trade = this.trades.get(tradeId)
    if (!trade) return
    this.manageController.updateTakeProfit(trade, price)
  }

  /** Recover trades after restart from exchange positions */
  async recover(): Promise<Trade[]> {
    this.assertNotShutdown()
    if (!this.gateway) return []

    const recovered = await this.recoveryController.recover(
      this.gateway,
      (trade) => this.registerTrade(trade),
    )

    for (const trade of recovered) {
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeOpened))
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeModified))
    }

    return recovered
  }

  /** Graceful shutdown */
  shutdown(): void {
    this.isShutdown = true
    this.unsubscribeOrderManager?.()
    this.eventBus.clear()
  }

  /** Read-only snapshot of active (non-terminal) trades */
  getActiveTrades(): Trade[] {
    return Array.from(this.trades.values()).filter(t => t.isActive)
  }

  /** Get trade by id */
  getTrade(tradeId: string): Trade | undefined {
    return this.trades.get(tradeId)
  }

  // ══════════════════════════════════════
  // Internal routing
  // ══════════════════════════════════════

  private handleOrderAccepted(trade: Trade): void {
    if (this.isEntryPhase(trade)) {
      this.entryController.onOrderAccepted(trade)
    }
    // No-op for exit phase (Status: ExitPending stays until fill)
  }

  private handlePartialFill(trade: Trade, fill: Fill): void {
    if (this.isEntryPhase(trade)) {
      this.entryController.onPartialFill(trade, fill)
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeEntryPartial))
    } else if (this.isExitPhase(trade)) {
      this.exitController.onPartialExitFill(trade, fill)
      // Always emit ExitPartial for the fill, then Closed if terminal
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeExitPartial))
      if (trade.isTerminal) {
        this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeClosed))
      }
    }
  }

  private handleFilled(trade: Trade, fill?: Fill): void {
    if (this.isEntryPhase(trade)) {
      this.entryController.onFilled(trade)
      if (trade.status === TradeStatus.Managing) {
        this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeEntryFilled))
        this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeModified))
      }
    } else if (this.isExitPhase(trade)) {
      if (fill) {
        this.exitController.onPartialExitFill(trade, fill)
        this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeExitPartial))
        if (trade.isTerminal) {
          this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeClosed))
        }
      } else {
        // Fallback: no fill object — reject if still open
        if (trade.openQuantity > 0 && !trade.isTerminal) {
          trade.reject('unexpected filled before all exit quantity filled')
          this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeErrored))
        } else if (trade.isTerminal) {
          this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeClosed))
        }
      }
    }
  }

  private handleCancelled(trade: Trade): void {
    if (this.isEntryPhase(trade)) {
      this.entryController.onCancelled(trade)
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeCancelled))
    } else if (this.isExitPhase(trade)) {
      // Exit cancelled → back to Managing
      trade.markErrored('exit cancelled')
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeErrored))
    }
  }

  private handleRejected(trade: Trade, reason: string): void {
    if (this.isEntryPhase(trade)) {
      this.entryController.onRejected(trade, reason)
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeRejected))
    } else {
      trade.reject(reason)
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeRejected))
    }
  }

  private handleExpired(trade: Trade): void {
    if (this.isEntryPhase(trade)) {
      this.entryController.onCancelled(trade)
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeCancelled))
    } else {
      trade.cancel()
      this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeCancelled))
    }
  }

  // ══════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════

  private registerTrade(trade: Trade): void {
    this.trades.set(trade.id, trade)
  }

  private findTradeByOrderId(orderId: string): Trade | undefined {
    const tradeId = this.orderToTrade.get(orderId)
    return tradeId ? this.trades.get(tradeId) : undefined
  }

  private mapLastOrderId(trade: Trade): void {
    if (trade.orderIds.length > 0) {
      this.orderToTrade.set(trade.orderIds[trade.orderIds.length - 1], trade.id)
    }
  }

  private isEntryPhase(trade: Trade): boolean {
    return trade.status === TradeStatus.EntryPending
        || trade.status === TradeStatus.EntryPartial
        || trade.status === TradeStatus.Created
  }

  private isExitPhase(trade: Trade): boolean {
    return trade.status === TradeStatus.ExitPending
        || trade.status === TradeStatus.ExitPartial
  }

  private getManagingTrades(symbol: string): Trade[] {
    const result: Trade[] = []
    for (const trade of this.trades.values()) {
      if (trade.status === TradeStatus.Managing && trade.symbol === symbol) {
        result.push(trade)
      }
    }
    return result
  }

  private async triggerExit(trade: Trade, decision: ExitDecision): Promise<void> {
    await this.exitController.requestClose(
      trade,
      decision.reason,
      this.orderManager,
      decision.exitType === 'limit' ? decision.exitPrice : undefined,
    )
    this.mapLastOrderId(trade)
    this.eventBus.emit(createTradeLifecycleEvent(trade, TradeEventType.TradeExitPending))
  }

  private assertNotShutdown(): void {
    if (this.isShutdown) {
      throw new Error('TradeLifecycleRuntime is shut down')
    }
  }
}
