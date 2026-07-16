/**
 * PaperProvider.ts — Paper trading provider (Dry Run)
 *
 * PaperProvider connects LiveFeedRuntime (market data) to existing
 * execution infrastructure (OrderMatcher, FillEngine, CashLedger,
 * PositionRuntime) to provide realistic virtual trading on real prices.
 *
 * Architecture:
 *   LiveFeedRuntime ──→ PaperProvider ──→ OrderMatcher
 *                                           ↓
 *                                        FillEngine
 *                                           ↓
 *                              ┌────────────┼────────────┐
 *                              ↓            ↓            ↓
 *                         CashLedger  PositionRuntime  TradeLedger
 *                              ↓            ↓
 *                              └───── EquityLedger
 *                                           ↓
 *                                    ExecutionEventBus
 *                                           ↓
 *                                    Metrics → Reports
 *
 * @since 4.1 (stub) / 4.3 (full)
 */

import type { OrderRequest, Order, Position, MarketSnapshot, TradeRecord } from '../../execution/types'
import { OrderStatus } from '../../execution/types'
import type { MarketEvent, TickerEvent, TradeEvent, KlineEvent } from '../types'

import { OrderBook } from '../../execution/orders/OrderBook'
import { OrderMatcher } from '../../execution/orders/OrderMatcher'
import { FillEngine } from '../../execution/fills/FillEngine'
import { PositionRuntime } from '../../execution/positions/PositionRuntime'
import { TradeLedger } from '../../execution/ledger/TradeLedger'
import { CashLedger } from '../../execution/ledger/CashLedger'
import { EquityLedger } from '../../execution/ledger/EquityLedger'
import { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import { FullFillPolicy } from '../../execution/fills/FillPolicy'
import { cancelOrder, fillOrder } from '../../execution/orders/OrderLifecycle'
import { TradeJournal } from '../journal/TradeJournal'

import type { ExecutionGateway, GatewayConfig, GatewayStatus, AccountInfo, OrderResult } from '../gateway/ExecutionGateway'
import { ExecutionMode } from '../gateway/ExecutionMode'

export interface PaperProviderConfig {
  initialBalance?: number
  commissionRate?: number
  slippageValue?: number
  /** Reference to the feed bus to subscribe to */
  feedBus?: {
    on: (event: string, handler: (event: MarketEvent) => void) => void
    off: (event: string, handler: (event: MarketEvent) => void) => void
  }
}

const PAPER_FILL_POLICY = new FullFillPolicy()

export class PaperProvider implements ExecutionGateway {
  readonly id = 'paper-provider'
  readonly mode = ExecutionMode.Paper

  // ── Public components (accessible for direct inspection) ──

  readonly orderBook: OrderBook
  readonly orderMatcher: OrderMatcher
  readonly fillEngine: FillEngine
  readonly positionRuntime: PositionRuntime
  readonly tradeLedger: TradeLedger
  readonly cashLedger: CashLedger
  readonly equityLedger: EquityLedger
  readonly events: ExecutionEventBus
  readonly journal: TradeJournal

  // ── Private state ──

  private config_: GatewayConfig | null = null
  private providerConfig: PaperProviderConfig
  private startTime = 0
  private lastSnapshot = new Map<string, MarketSnapshot>()
  private feedHandler: ((event: MarketEvent) => void) | null = null

  constructor(providerConfig?: PaperProviderConfig) {
    this.providerConfig = providerConfig ?? {}

    this.orderBook = new OrderBook()
    this.orderMatcher = new OrderMatcher()

    this.fillEngine = new FillEngine(
      { calculate: () => this.providerConfig.slippageValue ?? 0 },
      { calculate: (p) => (this.providerConfig.commissionRate ?? 0.001) * p.quantity * p.price },
      PAPER_FILL_POLICY,
    )

    this.positionRuntime = new PositionRuntime()
    this.tradeLedger = new TradeLedger()
    this.cashLedger = new CashLedger()
    this.equityLedger = new EquityLedger()
    this.events = new ExecutionEventBus()
    this.journal = new TradeJournal()
  }

  // ── Lifecycle ──

  async connect(config: GatewayConfig): Promise<void> {
    this.config_ = config
    this.startTime = Date.now()

    const initialBalance = config.initialBalance?.USDT ?? this.providerConfig.initialBalance ?? 10_000
    this.cashLedger.seed('USDT', initialBalance)
    this.equityLedger.seed(initialBalance)

    if (this.providerConfig.feedBus) {
      this.feedHandler = (event: MarketEvent) => this.handleMarketEvent(event)
      this.providerConfig.feedBus.on('market:ticker', this.feedHandler)
      this.providerConfig.feedBus.on('market:trade', this.feedHandler)
      this.providerConfig.feedBus.on('market:kline', this.feedHandler)
    }

    this.journal.record({ type: 'info', timestamp: Date.now(), message: `Paper trading started — balance: ${initialBalance} USDT` })
  }

  async disconnect(): Promise<void> {
    if (this.providerConfig.feedBus && this.feedHandler) {
      this.providerConfig.feedBus.off('market:ticker', this.feedHandler)
      this.providerConfig.feedBus.off('market:trade', this.feedHandler)
      this.providerConfig.feedBus.off('market:kline', this.feedHandler)
    }

    for (const order of this.orderBook.active()) {
      try { this.orderBook.update(order.id, (o) => cancelOrder(o)) } catch { /* already final */ }
    }

    this.config_ = null
    this.journal.record({ type: 'info', timestamp: Date.now(), message: 'Paper trading stopped' })
  }

  getStatus(): GatewayStatus {
    const positions = this.positionRuntime.getPositions()
    const latestEquity = this.equityLedger.latest()

    return {
      connected: this.config_ !== null,
      mode: this.mode,
      uptime: this.config_ ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      activeOrders: this.orderBook.active().length,
      openPositions: positions.length,
      totalEquity: latestEquity?.totalEquity,
      unrealizedPnl: latestEquity?.unrealizedPnl,
      journalSize: this.journal.size,
    }
  }

  // ── Orders ──

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    if (!request.symbol || !request.side || !request.quantity || request.quantity <= 0) {
      this.journal.record({ type: 'order:rejected', timestamp: Date.now(), orderId: request.id, symbol: request.symbol, strategyId: request.strategyId, message: 'Invalid order params' })
      return { accepted: false, orderId: request.id, message: 'Invalid order parameters' }
    }

    if (request.side === 'buy') {
      const estimatedCost = (request.price ?? 0) * request.quantity
      const quoteFree = this.cashLedger.free('USDT')
      if (estimatedCost > quoteFree) {
        this.journal.record({ type: 'order:rejected', timestamp: Date.now(), orderId: request.id, symbol: request.symbol, strategyId: request.strategyId, message: `Need ${estimatedCost.toFixed(2)} USDT, have ${quoteFree.toFixed(2)}` })
        return { accepted: false, orderId: request.id, message: 'Insufficient balance' }
      }
    } else {
      const baseFree = this.cashLedger.free(request.symbol)
      if (request.quantity > baseFree) {
        this.journal.record({ type: 'order:rejected', timestamp: Date.now(), orderId: request.id, symbol: request.symbol, strategyId: request.strategyId, message: `Need ${request.quantity} ${request.symbol}, have ${baseFree.toFixed(4)}` })
        return { accepted: false, orderId: request.id, message: `Insufficient ${request.symbol}` }
      }
    }

    const order = this.orderBook.add(request)
    this.events.emit({ type: 'ORDER_ACCEPTED', order, timestamp: Date.now() })

    this.journal.record({
      type: 'order:accepted', timestamp: Date.now(), orderId: order.id, symbol: order.symbol, strategyId: order.strategyId,
      message: `${request.side.toUpperCase()} ${request.quantity} ${request.symbol} ${request.type} ${request.price ?? ''}${request.stopPrice != null ? ` stop=${request.stopPrice}` : ''}`,
    })

    if (request.type === 'market') {
      const snapshot = this.lastSnapshot.get(request.symbol)
      if (snapshot) this.matchOrder(order, snapshot)
    }

    return { accepted: true, orderId: order.id, message: 'Order accepted by paper provider' }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const updated = this.orderBook.update(orderId, (o) => cancelOrder(o))
      this.events.emit({ type: 'ORDER_CANCELLED', order: updated, timestamp: Date.now() })
      this.journal.record({ type: 'order:cancelled', timestamp: Date.now(), orderId: updated.id, symbol: updated.symbol, strategyId: updated.strategyId, message: 'Order cancelled' })
      return true
    } catch {
      return false
    }
  }

  async replaceOrder(orderId: string, request: Partial<OrderRequest>): Promise<OrderResult> {
    const existing = this.orderBook.get(orderId)
    if (!existing) return { accepted: false, orderId, message: 'Order not found' }

    const cancelled = await this.cancelOrder(orderId)
    if (!cancelled) return { accepted: false, orderId, message: 'Failed to cancel existing order' }

    const newRequest: OrderRequest = {
      id: `rpl_${orderId}_${Date.now()}`,
      strategyId: existing.strategyId,
      symbol: existing.symbol,
      side: existing.side,
      type: request.type ?? existing.type,
      quantity: request.quantity ?? existing.quantity,
      price: request.price ?? existing.price,
      stopPrice: request.stopPrice ?? existing.stopPrice,
      timestamp: Date.now(),
    }
    return this.placeOrder(newRequest)
  }

  async getOrders(): Promise<Order[]> {
    return this.orderBook.all()
  }

  async getPositions(): Promise<Position[]> {
    return this.positionRuntime.getPositions()
  }

  async getPosition(symbol: string): Promise<Position | null> {
    return this.positionRuntime.getPosition(symbol) ?? null
  }

  async getBalance(): Promise<AccountInfo> {
    const positions = this.positionRuntime.getPositions()
    const latestEquity = this.equityLedger.latest()

    const balances: Record<string, { free: number; locked: number }> = {}
    for (const cb of this.cashLedger.all()) {
      balances[cb.asset] = { free: cb.free, locked: cb.locked }
    }

    const realizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0)

    return {
      totalEquity: latestEquity?.totalEquity ?? 0,
      balances,
      unrealizedPnl: latestEquity?.unrealizedPnl ?? 0,
      realizedPnl,
      mode: this.mode,
    }
  }

  // ── Events ──

  on(_event: string, listener: (...args: unknown[]) => void): void {
    this.events.subscribe(listener as any)
  }

  off(_event: string, _listener: (...args: unknown[]) => void): void {
    // Unsubscribe via the function returned by on()
  }

  // ── Market Event Handling ──

  private handleMarketEvent(event: MarketEvent): void {
    let snapshot: MarketSnapshot | undefined

    switch (event.type) {
      case 'market:ticker':
        snapshot = this.tickerToSnapshot(event.data)
        break
      case 'market:trade':
        snapshot = this.tradeToSnapshot(event.data)
        break
      case 'market:kline':
        snapshot = this.klineToSnapshot(event.data)
        break
    }

    if (snapshot) {
      this.lastSnapshot.set(snapshot.symbol, snapshot)
      this.processMarket(snapshot)
    }
  }

  private processMarket(snapshot: MarketSnapshot): void {
    const matchingOrders = this.orderBook.active().filter(o => o.symbol === snapshot.symbol)
    if (matchingOrders.length === 0) return

    const triggered = this.orderMatcher.evaluate(matchingOrders, snapshot)
    for (const order of triggered) {
      this.matchOrder(order, snapshot)
    }

    this.positionRuntime.markToMarket(snapshot.symbol, snapshot.last)
  }

  private matchOrder(order: Order, market: MarketSnapshot): void {
    const result = this.fillEngine.execute(order, market)
    if (result.fills.length === 0) return

    for (const fill of result.fills) {
      this.cashLedger.applyFill(fill)
      this.tradeLedger.record(fill, order, 0)

      const updated = this.orderBook.update(order.id, (o) => fillOrder(o, fill.quantity, fill.price, fill.commission))
      this.positionRuntime.applyFill(fill, order)

      const tradeRecord: TradeRecord = {
        id: fill.id,
        symbol: fill.symbol,
        side: fill.side,
        quantity: fill.quantity,
        price: fill.price,
        commission: fill.commission,
        realizedPnl: 0,
        timestamp: fill.timestamp,
        strategyId: order.strategyId,
        orderId: order.id,
      }

      this.events.emit({ type: 'ORDER_FILLED', order: updated, fill, timestamp: Date.now() })
      this.events.emit({ type: 'TRADE_RECORDED', trade: tradeRecord, timestamp: Date.now() })

      const statusLabel = updated.status === OrderStatus.FILLED ? 'FILLED' : 'PARTIAL'
      this.journal.record({
        type: updated.status === OrderStatus.FILLED ? 'order:filled' : 'order:partially_filled',
        timestamp: Date.now(), orderId: order.id, symbol: order.symbol, strategyId: order.strategyId,
        message: `${statusLabel} ${fill.quantity} @ ${fill.price} (fee ${fill.commission.toFixed(4)})`,
      })
    }

    this.positionRuntime.markToMarket(market.symbol, market.last)

    const position = this.positionRuntime.getPosition(market.symbol)
    if (position && position.direction === 'flat') {
      this.events.emit({ type: 'POSITION_CLOSED', position, realizedPnl: position.realizedPnl, timestamp: Date.now() })
      this.journal.record({ type: 'position:closed', timestamp: Date.now(), symbol: market.symbol, strategyId: order.strategyId, message: `Position closed — PnL: ${position.realizedPnl.toFixed(2)}` })
    }

    const positions = this.positionRuntime.getPositions()
    const cash = this.cashLedger.get('USDT')
    const snapshot = this.equityLedger.snapshot(cash.total, positions)
    this.events.emit({ type: 'EQUITY_CHANGED', equity: snapshot, timestamp: Date.now() })
  }

  // ── Snapshot Conversion ──

  private tickerToSnapshot(ticker: TickerEvent): MarketSnapshot {
    const spread = ticker.price * 0.001
    return {
      symbol: ticker.symbol,
      bid: ticker.price - spread,
      ask: ticker.price + spread,
      last: ticker.price,
      volume: ticker.volume24h,
      timestamp: ticker.timestamp,
    }
  }

  private tradeToSnapshot(trade: TradeEvent): MarketSnapshot {
    const spread = trade.price * 0.001
    return {
      symbol: trade.symbol,
      bid: trade.side === 'sell' ? trade.price : trade.price - spread,
      ask: trade.side === 'buy' ? trade.price : trade.price + spread,
      last: trade.price,
      volume: trade.quantity,
      timestamp: trade.timestamp,
    }
  }

  private klineToSnapshot(kline: KlineEvent): MarketSnapshot {
    return {
      symbol: kline.symbol,
      bid: kline.close,
      ask: kline.close,
      last: kline.close,
      volume: kline.volume,
      timestamp: kline.timestamp,
    }
  }
}
