/**
 * PaperBrokerAdapter.ts — Paper trading adapter implementing BrokerAdapter
 *
 * Wraps PaperProvider (ExecutionGateway) in the BrokerAdapter interface
 * so it's usable with CertificationRuntime and the broader trading pipeline.
 *
 * Architecture:
 *   BybitFeedAdapter → LiveFeedRuntime → PaperProvider → PaperBrokerAdapter → CertificationRuntime
 *
 * No API keys required — uses real market data from live feeds,
 * virtual execution via PaperProvider's order book, fill engine, and ledgers.
 *
 * @since 4.9
 */

import type {
  BrokerAdapter,
  ConnectionAdapter,
  OrderAdapter,
  PositionAdapter,
  AccountAdapter,
} from '../live/BrokerAdapter'
import type {
  BrokerOrder,
  BrokerPosition,
  BrokerBalance,
  BrokerAccountInfo,
  BrokerFill,
  BrokerPlacementParams,
} from '../live/types'
import type { BrokerCapabilities } from '../live/BrokerCapabilities'
import { BYBIT_CAPABILITIES } from '../live/BrokerCapabilities'
import { ValidationError } from '../live/BrokerError'
import { OrderValidator } from '../validation/OrderValidator'

import { PaperProvider, type PaperProviderConfig } from '../providers/PaperProvider'
import type { LiveFeedRuntime } from '../feed/LiveFeedRuntime'
import type { OrderRequest, OrderSide, OrderType, TimeInForce } from '../../execution/types'

export interface PaperBrokerConfig {
  /** Initial balance in USDT (default: 10,000) */
  initialBalance?: number
  /** Commission rate (default: 0.001 = 0.1%) */
  commissionRate?: number
  /** Slippage per fill (default: 0) */
  slippageValue?: number
  /** Symbols to subscribe to from the feed */
  symbols?: string[]
  /**
   * Seed base asset balances for sell orders (default: false).
   * When true, each configured symbol gets a starting balance equal to
   * initialBalance / symbolCount / price, allowing sells without a prior buy.
   * Use ONLY for specialized tests (reduceOnly, commission, stress).
   * For Paper Campaign / Certification / Nightly Regression leave false
   * so the ledger starts clean (USDT only) matching real exchange behavior.
   */
  seedBaseAssets?: boolean
}

export class PaperBrokerAdapter implements BrokerAdapter {
  readonly id = 'paper'
  readonly name = 'Paper Trading'
  readonly capabilities: BrokerCapabilities = {
    ...BYBIT_CAPABILITIES,
  }

  readonly connection: ConnectionAdapter
  readonly orders: OrderAdapter
  readonly positions: PositionAdapter
  readonly account: AccountAdapter

  readonly paper: PaperProvider
  readonly feedRuntime: LiveFeedRuntime
  readonly orderValidator: OrderValidator

  private config: Required<PaperBrokerConfig>
  private connected = false
  private orderIdCounter = 0
  private orderStore = new Map<string, BrokerOrder>()
  private fillStore: BrokerFill[] = []

  private orderHandlers: Array<(order: BrokerOrder) => void> = []
  private fillHandlers: Array<(fill: BrokerFill) => void> = []
  private positionHandlers: Array<(pos: BrokerPosition) => void> = []
  private balanceHandlers: Array<(balances: Record<string, BrokerBalance>) => void> = []

  constructor(
    feedRuntime: LiveFeedRuntime,
    config: PaperBrokerConfig = {},
  ) {
    this.feedRuntime = feedRuntime
    this.config = {
      initialBalance: 10_000,
      commissionRate: 0.001,
      slippageValue: 0,
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      seedBaseAssets: false,
      ...config,
    }

    const paperConfig: PaperProviderConfig = {
      initialBalance: this.config.initialBalance,
      commissionRate: this.config.commissionRate,
      slippageValue: this.config.slippageValue,
      feedBus: feedRuntime.bus,
    }

    this.paper = new PaperProvider({
      ...paperConfig,
      symbolRegistry: feedRuntime.symbols,
    })
    this.orderValidator = new OrderValidator(feedRuntime.symbols)

    // Subscribe to PaperProvider events and mirror as BrokerAdapter events
    this.paper.events.subscribe((event: any) => {
      if (event.type === 'ORDER_FILLED' || event.type === 'ORDER_ACCEPTED' || event.type === 'ORDER_CANCELLED') {
        const brokerOrder = this.toBrokerOrder(event.order)
        this.orderStore.set(brokerOrder.brokerOrderId, brokerOrder)
        this.notifyOrderHandlers(brokerOrder)
      }
    })

    this.connection = new PaperConnectionAdapter(this)
    this.orders = new PaperOrderAdapter(this)
    this.positions = new PaperPositionAdapter(this)
    this.account = new PaperAccountAdapter(this)
  }

  dispose(): Promise<void> {
    this.connected = false
    this.orderHandlers = []
    this.fillHandlers = []
    this.positionHandlers = []
    this.balanceHandlers = []
    return this.paper.disconnect()
  }

  // ── Internal helpers ──

  private nextOrderId(): string {
    return `paper-${++this.orderIdCounter}-${Date.now()}`
  }

  /** Seed base asset so sell orders can execute */
  seedBaseAssets(): void {
    const initialBalance = this.config.initialBalance
    const symbolCount = this.config.symbols.length
    const basePerSymbol = initialBalance / symbolCount

    // Default prices for common USDT pairs (mirrors PaperProvider's defaults)
    const DEFAULT_PRICES: Record<string, number> = {
      BTCUSDT: 60000,
      ETHUSDT: 3000,
      SOLUSDT: 140,
      XRPUSDT: 0.5,
      DOGEUSDT: 0.08,
      ADAUSDT: 0.45,
      AVAXUSDT: 35,
      LINKUSDT: 14,
      MATICUSDT: 0.55,
      DOTUSDT: 7,
    }

    for (const symbol of this.config.symbols) {
      const price = DEFAULT_PRICES[symbol.toUpperCase()] ?? 1
      const quantity = Math.round((basePerSymbol / price) * 1_000_000) / 1_000_000
      // Add balance without clearing existing USDT seed
      this.paper.cashLedger.addBalance(symbol, quantity || 1)
    }
  }

  /** Convert a PaperProvider OrderRequest from BrokerPlacementParams */
  toOrderRequest(params: BrokerPlacementParams): OrderRequest {
    const mapType = (t: string): OrderType => {
      const lower = t.toLowerCase()
      if (lower === 'stop_loss_limit') return 'stop_limit'
      if (lower === 'stop_loss' || lower === 'stop_market') return 'stop'
      return lower as OrderType
    }

    const mapTif = (t?: string): TimeInForce => {
      if (t === 'IOC') return 'IOC'
      if (t === 'FOK') return 'FOK'
      if (t === 'DAY') return 'DAY'
      return 'GTC'
    }

    return {
      id: this.nextOrderId(),
      strategyId: 'certification',
      symbol: params.symbol,
      side: params.side as OrderSide,
      type: mapType(params.type),
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      reduceOnly: params.reduceOnly,
      timeInForce: mapTif(params.timeInForce),
      clientId: params.clientOrderId,
      timestamp: Date.now(),
    }
  }

  /** Convert a PaperProvider Order to a BrokerOrder */
  toBrokerOrder(order: any): BrokerOrder {
    const statusMap: Record<string, string> = {
      accepted: 'NEW',
      pending: 'NEW',
      partially_filled: 'PARTIALLY_FILLED',
      filled: 'FILLED',
      cancelled: 'CANCELLED',
      rejected: 'REJECTED',
      expired: 'EXPIRED',
    }

    return {
      brokerOrderId: order.id,
      clientOrderId: order.clientId,
      symbol: order.symbol,
      side: order.side,
      type: (order.type ?? 'UNKNOWN').toUpperCase(),
      status: statusMap[order.status] ?? order.status?.toUpperCase() ?? 'UNKNOWN',
      quantity: order.quantity ?? 0,
      filledQuantity: order.filledQuantity ?? 0,
      price: order.price,
      stopPrice: order.stopPrice,
      averagePrice: order.averagePrice ?? 0,
      commission: order.commission ?? 0,
      commissionAsset: 'USDT',
      timeInForce: order.timeInForce?.toUpperCase() ?? 'GTC',
      reduceOnly: order.reduceOnly,
      createdAt: order.createdAt ?? Date.now(),
      updatedAt: order.updatedAt ?? Date.now(),
    }
  }

  /** Convert a Fill to a BrokerFill */
  toBrokerFill(fill: any, orderId?: string): BrokerFill {
    return {
      id: fill.id ?? `fill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderId: fill.orderId ?? orderId ?? '',
      brokerOrderId: fill.orderId ?? orderId ?? '',
      symbol: fill.symbol ?? '',
      side: fill.side ?? 'buy',
      quantity: fill.quantity ?? 0,
      price: fill.price ?? 0,
      commission: fill.commission ?? 0,
      commissionAsset: fill.commissionAsset ?? 'USDT',
      realizedPnl: fill.realizedPnl,
      timestamp: fill.timestamp ?? Date.now(),
    }
  }

  /** Convert a PaperProvider Position to a BrokerPosition */
  toBrokerPosition(pos: any): BrokerPosition {
    return {
      symbol: pos.symbol,
      direction: pos.direction === 'flat' ? 'long' : (pos.direction as 'long' | 'short'),
      quantity: pos.quantity ?? 0,
      averageEntryPrice: pos.averageEntryPrice ?? 0,
      currentPrice: pos.currentPrice ?? 0,
      unrealizedPnl: pos.unrealizedPnl ?? 0,
      realizedPnl: pos.realizedPnl ?? 0,
      liquidationPrice: pos.liquidationPrice,
      margin: pos.margin,
      leverage: pos.leverage,
      updatedAt: pos.updatedAt ?? Date.now(),
    }
  }

  private notifyOrderHandlers(order: BrokerOrder): void {
    for (const h of this.orderHandlers) h({ ...order })
  }

  private notifyFillHandlers(fill: BrokerFill): void {
    for (const h of this.fillHandlers) h({ ...fill })
  }

  private notifyPositionHandlers(pos: BrokerPosition): void {
    for (const h of this.positionHandlers) h({ ...pos })
  }

  private notifyBalanceHandlers(balances: Record<string, BrokerBalance>): void {
    for (const h of this.balanceHandlers) h({ ...balances })
  }
}

// ── Connection ──

class PaperConnectionAdapter implements ConnectionAdapter {
  private owner: PaperBrokerAdapter

  constructor(owner: PaperBrokerAdapter) {
    this.owner = owner
  }

  async connect(apiKey?: string, apiSecret?: string, testnet?: boolean): Promise<void> {
    if (this.owner.connected) return

    // Start the feed runtime
    await this.owner.feedRuntime.start()

    // Subscribe to configured symbols on the feed
    for (const symbol of this.owner.config.symbols) {
      await this.owner.feedRuntime.subscribe(symbol)
    }

    // Connect the paper provider
    await this.owner.paper.connect({
      mode: 'paper',
      initialBalance: { USDT: this.owner.config.initialBalance },
      symbols: this.owner.config.symbols,
    })

    // Seed base asset balances for sell orders (opt-in, default off — see #seedBaseAssets)
    if (this.owner.config.seedBaseAssets) {
      this.owner.seedBaseAssets()
    }

    this.owner.connected = true
  }

  async disconnect(): Promise<void> {
    if (!this.owner.connected) return
    this.owner.connected = false

    await this.owner.paper.disconnect()
    await this.owner.feedRuntime.stop()
  }

  isConnected(): boolean {
    return this.owner.connected
  }

  async getServerTime(): Promise<number> {
    return Date.now()
  }
}

// ── Orders ──

class PaperOrderAdapter implements OrderAdapter {
  private owner: PaperBrokerAdapter

  constructor(owner: PaperBrokerAdapter) {
    this.owner = owner
  }

  subscribeOrders(handler: (order: BrokerOrder) => void): () => void {
    this.owner.orderHandlers.push(handler)
    return () => {
      const idx = this.owner.orderHandlers.indexOf(handler)
      if (idx >= 0) this.owner.orderHandlers.splice(idx, 1)
    }
  }

  subscribeFills(handler: (fill: BrokerFill) => void): () => void {
    this.owner.fillHandlers.push(handler)
    return () => {
      const idx = this.owner.fillHandlers.indexOf(handler)
      if (idx >= 0) this.owner.fillHandlers.splice(idx, 1)
    }
  }

  async placeOrder(params: BrokerPlacementParams): Promise<BrokerOrder> {
    if (!this.owner.connected) {
      throw new ValidationError('Not connected — call connect() first')
    }

    // ── Comprehensive order validation ──
    const orderRequest = this.owner.toOrderRequest(params)
    this.owner.orderValidator.validate(orderRequest)
    const result = await this.owner.paper.placeOrder(orderRequest)

    if (!result.accepted) {
      throw new ValidationError(result.message ?? 'Order rejected by paper provider')
    }

    // After placing, the PaperProvider may fill market orders immediately.
    // We need to find the order in PaperProvider's order book.
    const paperOrders = await this.owner.paper.getOrders()
    const placedOrder = paperOrders.find((o: any) => o.id === result.orderId)

    if (!placedOrder) {
      // Order was created — build minimal representation
      const brokerOrder: BrokerOrder = {
        brokerOrderId: result.orderId ?? orderRequest.id,
        clientOrderId: params.clientOrderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type?.toUpperCase() ?? 'UNKNOWN',
        status: 'NEW',
        quantity: params.quantity,
        filledQuantity: 0,
        price: params.price,
        stopPrice: params.stopPrice,
        averagePrice: params.price ?? 0,
        commission: 0,
        commissionAsset: 'USDT',
        timeInForce: params.timeInForce ?? 'GTC',
        reduceOnly: params.reduceOnly,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      this.owner.orderStore.set(brokerOrder.brokerOrderId, brokerOrder)
      return brokerOrder
    }

    // Sync fills from trade ledger
    for (const trade of this.owner.paper.tradeLedger.all()) {
      const existing = this.owner.fillStore.find((f) => f.id === trade.id)
      if (!existing) {
        const bf = this.owner.toBrokerFill(trade, placedOrder.id)
        this.owner.fillStore.push(bf)
        this.owner.notifyFillHandlers(bf)
      }
    }

    const brokerOrder = this.owner.toBrokerOrder(placedOrder)
    this.owner.orderStore.set(brokerOrder.brokerOrderId, brokerOrder)
    this.owner.notifyOrderHandlers(brokerOrder)

    return brokerOrder
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      return await this.owner.paper.cancelOrder(orderId)
    } catch {
      return false
    }
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    const openOrders = (await this.getOpenOrders(symbol))
    let count = 0
    for (const order of openOrders) {
      const cancelled = await this.cancelOrder(order.brokerOrderId)
      if (cancelled) count++
    }
    return count
  }

  async replaceOrder(orderId: string, params: Partial<BrokerPlacementParams>): Promise<BrokerOrder> {
    const result = await this.owner.paper.replaceOrder(orderId, {
      type: params.type?.toLowerCase() as any,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
    })

    if (!result.accepted) {
      throw new ValidationError(result.message ?? 'Replace failed')
    }

    const paperOrders = await this.owner.paper.getOrders()
    const placedOrder = paperOrders.find((o: any) => o.id === result.orderId)
    if (!placedOrder) throw new ValidationError('Replaced order not found')

    const brokerOrder = this.owner.toBrokerOrder(placedOrder)
    this.owner.orderStore.set(brokerOrder.brokerOrderId, brokerOrder)
    return brokerOrder
  }

  async getOrder(orderId: string): Promise<BrokerOrder | null> {
    // Check local cache first
    const cached = this.owner.orderStore.get(orderId)
    if (cached) return cached

    // Fall back to PaperProvider
    const paperOrders = await this.owner.paper.getOrders()
    const found = paperOrders.find((o: any) => o.id === orderId)
    return found ? this.owner.toBrokerOrder(found) : null
  }

  async getOpenOrders(symbol?: string): Promise<BrokerOrder[]> {
    const paperOrders = await this.owner.paper.getOrders()
    return paperOrders
      .filter((o: any) => {
        const open = o.status === 'accepted' || o.status === 'partially_filled' || o.status === 'pending'
        return symbol ? open && o.symbol === symbol : open
      })
      .map((o: any) => this.owner.toBrokerOrder(o))
  }

  async getOrderHistory(symbol: string, limit = 50): Promise<BrokerOrder[]> {
    const paperOrders = await this.owner.paper.getOrders()
    return paperOrders
      .filter((o: any) => o.symbol === symbol)
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((o: any) => this.owner.toBrokerOrder(o))
  }
}

// ── Positions ──

class PaperPositionAdapter implements PositionAdapter {
  private owner: PaperBrokerAdapter

  constructor(owner: PaperBrokerAdapter) {
    this.owner = owner
  }

  subscribePositions(handler: (pos: BrokerPosition) => void): () => void {
    this.owner.positionHandlers.push(handler)
    return () => {
      const idx = this.owner.positionHandlers.indexOf(handler)
      if (idx >= 0) this.owner.positionHandlers.splice(idx, 1)
    }
  }

  async getPositions(symbol?: string): Promise<BrokerPosition[]> {
    const positions = await this.owner.paper.getPositions()
    const list = symbol
      ? positions.filter((p: any) => p.symbol === symbol)
      : positions
    return list.map((p: any) => this.owner.toBrokerPosition(p))
  }

  async getPosition(symbol: string): Promise<BrokerPosition | null> {
    const pos = await this.owner.paper.getPosition(symbol)
    return pos ? this.owner.toBrokerPosition(pos) : null
  }
}

// ── Account ──

class PaperAccountAdapter implements AccountAdapter {
  private owner: PaperBrokerAdapter

  constructor(owner: PaperBrokerAdapter) {
    this.owner = owner
  }

  subscribeBalances(handler: (balances: Record<string, BrokerBalance>) => void): () => void {
    this.owner.balanceHandlers.push(handler)
    return () => {
      const idx = this.owner.balanceHandlers.indexOf(handler)
      if (idx >= 0) this.owner.balanceHandlers.splice(idx, 1)
    }
  }

  async getBalances(): Promise<Record<string, BrokerBalance>> {
    const accInfo = await this.owner.paper.getBalance()
    const result: Record<string, BrokerBalance> = {}
    for (const [asset, balance] of Object.entries(accInfo.balances ?? {})) {
      const b = balance as any
      result[asset] = {
        asset,
        free: (b.free as number) ?? 0,
        locked: (b.locked as number) ?? 0,
        total: ((b.free as number) ?? 0) + ((b.locked as number) ?? 0),
      }
    }
    return result
  }

  async getAccountInfo(): Promise<BrokerAccountInfo> {
    const accInfo = await this.owner.paper.getBalance()
    const balances = await this.getBalances()
    return {
      balances,
      totalEquity: accInfo.totalEquity ?? 0,
      unrealizedPnl: accInfo.unrealizedPnl ?? 0,
      canTrade: true,
      isTestnet: true,
    }
  }
}
