/**
 * BinanceSpotBrokerAdapter.ts — Binance Spot exchange adapter
 *
 * Full BrokerAdapter implementation for Binance Spot (REST + WebSocket).
 *
 * Architecture:
 *   BinanceSpotBrokerAdapter
 *     ├── BinanceSpotConnectionAdapter  — connect/disconnect, serverTime, listenKey
 *     ├── BinanceSpotOrderAdapter       — REST orders + WS order/fill subscriptions
 *     ├── BinanceSpotPositionAdapter    — (Spot has no positions; returns [])
 *     ├── BinanceSpotAccountAdapter     — balances, account info + WS balance updates
 *     ├── BinanceUserDataStream         — listenKey management + WebSocket lifecycle
 *     └── BinanceSymbolFilter           — LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL
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
import type { BrokerCapabilities } from '../live/BrokerCapabilities'
import type {
  BrokerOrder,
  BrokerPosition,
  BrokerBalance,
  BrokerAccountInfo,
  BrokerFill,
  BrokerPlacementParams,
} from '../live/types'
import { BINANCE_SPOT_CAPABILITIES } from '../live/BrokerCapabilities'
import {
  BrokerError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  RateLimitError,
  ExchangeRejectedError,
  classifyBrokerError,
} from '../live/BrokerError'
import { BrokerClock } from '../live/BrokerClock'

// ═══════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════

const BASE_REST_URL = 'https://api.binance.com'
const BASE_WS_URL = 'wss://stream.binance.com:9443/ws'
const TESTNET_REST_URL = 'https://testnet.binance.vision'
const TESTNET_WS_URL = 'wss://testnet.binance.vision/ws'

// ═══════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════

export interface BinanceSpotConfig {
  apiKey?: string
  apiSecret?: string
  testnet?: boolean
  recvWindow?: number
  wsReconnectDelayMs?: number
  maxWsReconnectAttempts?: number
  listenKeyRefreshIntervalMs?: number
  restBaseUrl?: string
  wsBaseUrl?: string
}

const DEFAULTS: Required<Omit<BinanceSpotConfig, 'apiKey' | 'apiSecret'>> = {
  testnet: false,
  recvWindow: 5_000,
  wsReconnectDelayMs: 2_000,
  maxWsReconnectAttempts: 10,
  listenKeyRefreshIntervalMs: 30 * 60 * 1000, // 30 min
  restBaseUrl: BASE_REST_URL,
  wsBaseUrl: BASE_WS_URL,
}

// ═══════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════

interface BinanceSpotState {
  connected: boolean
  config: Required<BinanceSpotConfig>
  clock: BrokerClock
  listenKey: string | null
  listenKeyRefreshTimer: ReturnType<typeof setInterval> | null

  orderHandlers: Array<(order: BrokerOrder) => void>
  fillHandlers: Array<(fill: BrokerFill) => void>
  positionHandlers: Array<(pos: BrokerPosition) => void>
  balanceHandlers: Array<(balances: Record<string, BrokerBalance>) => void>

  symbolFilters: Map<string, BinanceSymbolFilterInfo> | null
}

// ═══════════════════════════════════════════════
// Symbol Filter Types
// ═══════════════════════════════════════════════

export interface LotSizeFilter {
  filterType: 'LOT_SIZE'
  minQty: string
  maxQty: string
  stepSize: string
}

export interface PriceFilter {
  filterType: 'PRICE_FILTER'
  minPrice: string
  maxPrice: string
  tickSize: string
}

export interface MinNotionalFilter {
  filterType: 'MIN_NOTIONAL'
  minNotional: string
}

export type BinanceSymbolFilterInfo = {
  symbol: string
  status: string
  baseAsset: string
  quoteAsset: string
  filters: (LotSizeFilter | PriceFilter | MinNotionalFilter)[]
}

// ═══════════════════════════════════════════════
// Adapter
// ═══════════════════════════════════════════════

export class BinanceSpotBrokerAdapter implements BrokerAdapter {
  readonly id = 'binance-spot'
  readonly name = 'Binance Spot'
  readonly capabilities: BrokerCapabilities = BINANCE_SPOT_CAPABILITIES

  readonly connection: ConnectionAdapter
  readonly orders: OrderAdapter
  readonly positions: PositionAdapter
  readonly account: AccountAdapter

  readonly state: BinanceSpotState
  readonly userDataStream: BinanceUserDataStream
  readonly filterValidator: BinanceSymbolFilterValidator

  constructor(config: BinanceSpotConfig = {}) {
    const merged: Required<BinanceSpotConfig> = {
      ...DEFAULTS,
      ...config,
      restBaseUrl: config.testnet ? TESTNET_REST_URL : (config.restBaseUrl ?? DEFAULTS.restBaseUrl),
      wsBaseUrl: config.testnet ? TESTNET_WS_URL : (config.wsBaseUrl ?? DEFAULTS.wsBaseUrl),
    }

    this.state = {
      connected: false,
      config: merged,
      clock: new BrokerClock(),
      listenKey: null,
      listenKeyRefreshTimer: null,
      orderHandlers: [],
      fillHandlers: [],
      positionHandlers: [],
      balanceHandlers: [],
      symbolFilters: null,
    }

    this.userDataStream = new BinanceUserDataStream(this)
    this.filterValidator = new BinanceSymbolFilterValidator(this)

    this.connection = new BinanceSpotConnectionAdapter(this)
    this.orders = new BinanceSpotOrderAdapter(this)
    this.positions = new BinanceSpotPositionAdapter(this)
    this.account = new BinanceSpotAccountAdapter(this)
  }

  dispose(): Promise<void> {
    this.userDataStream.stop()
    this.state.orderHandlers = []
    this.state.fillHandlers = []
    this.state.positionHandlers = []
    this.state.balanceHandlers = []
    this.state.connected = false
    return Promise.resolve()
  }
}

// ═══════════════════════════════════════════════
// Helper: Signed REST request
// ═══════════════════════════════════════════════

async function signedRequest(
  state: BinanceSpotState,
  method: string,
  path: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  if (!state.config.apiKey || !state.config.apiSecret) {
    throw new AuthenticationError('Binance Spot: API key and secret required')
  }

  // Build query string with timestamp
  const timestamp = state.clock.timestampForExchange()
  const queryParams = {
    ...params,
    timestamp,
    recvWindow: state.config.recvWindow,
  }
  const queryString = Object.entries(queryParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')

  // Sign
  const signature = await hmacSha256(state.config.apiSecret, queryString)
  const signedQuery = `${queryString}&signature=${signature}`

  const url = `${state.config.restBaseUrl}${path}?${signedQuery}`

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'X-MBX-APIKEY': state.config.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    // Update clock from response headers (Binance sends Date header)
    const dateHeader = res.headers.get('Date')
    if (dateHeader) {
      const serverTime = new Date(dateHeader).getTime()
      if (!isNaN(serverTime)) state.clock.sync(serverTime)
    }

    if (!res.ok) {
      const body = await res.text()
      throw mapBinanceError(res.status, body)
    }

    return await res.json()
  } catch (err) {
    if (err instanceof BrokerError) throw err
    throw new NetworkError(`Binance Spot REST error: ${String(err)}`)
  }
}

async function publicRequest(
  state: BinanceSpotState,
  path: string,
  params: Record<string, string | number> = {},
): Promise<any> {
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')

  const url = `${state.config.restBaseUrl}${path}${queryString ? '?' + queryString : ''}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text()
      throw mapBinanceError(res.status, body)
    }
    return await res.json()
  } catch (err) {
    if (err instanceof BrokerError) throw err
    throw new NetworkError(`Binance Spot REST error: ${String(err)}`)
  }
}

function mapBinanceError(status: number, body: string): BrokerError {
  const lower = body.toLowerCase()

  if (status === 401 || status === 403) {
    return new AuthenticationError(`Binance auth error: ${body}`)
  }
  if (status === 429 || status === 418) {
    return new RateLimitError(60_000, body)
  }
  if (lower.includes('filter') || lower.includes('lot') || lower.includes('price') || lower.includes('notional')) {
    return new ValidationError(`Binance filter validation: ${body}`, body)
  }
  if (lower.includes('-2010')) {
    return new ExchangeRejectedError(`Binance rejected order: insufficient balance`, body)
  }
  if (lower.includes('-2011')) {
    return new ExchangeRejectedError(`Binance rejected order: unknown order`, body)
  }

  return new ExchangeRejectedError(`Binance error: ${body}`, body)
}

// HMAC-SHA256 for browser/Node
async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ═══════════════════════════════════════════════
// User Data Stream — listenKey lifecycle + WS
// ═══════════════════════════════════════════════

export class BinanceUserDataStream {
  private owner: BinanceSpotBrokerAdapter
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private shouldReconnect = false

  constructor(owner: BinanceSpotBrokerAdapter) {
    this.owner = owner
  }

  async start(): Promise<void> {
    const state = this.owner.state
    if (!state.config.apiKey) throw new AuthenticationError('Binance Spot: API key required for user data stream')

    // Create listenKey
    const data = await publicRequest(state, '/api/v3/userDataStream')
    state.listenKey = data.listenKey

    // Start keepalive timer
    state.listenKeyRefreshTimer = setInterval(() => {
      this.keepAlive()
    }, state.config.listenKeyRefreshIntervalMs)

    // Connect WebSocket
    this.shouldReconnect = true
    this.connectWebSocket()
  }

  stop(): void {
    this.shouldReconnect = false
    this.closeWebSocket()

    const state = this.owner.state
    if (state.listenKeyRefreshTimer) {
      clearInterval(state.listenKeyRefreshTimer)
      state.listenKeyRefreshTimer = null
    }
  }

  private async keepAlive(): Promise<void> {
    const state = this.owner.state
    if (!state.listenKey) return

    try {
      await publicRequest(state, '/api/v3/userDataStream', {
        listenKey: state.listenKey,
      })
    } catch {
      // If keepalive fails, try to create a new listenKey
      try {
        const data = await publicRequest(state, '/api/v3/userDataStream')
        state.listenKey = data.listenKey
        this.reconnectWebSocket()
      } catch {
        // Give up
      }
    }
  }

  private connectWebSocket(): void {
    const state = this.owner.state
    if (!state.listenKey) return

    const url = `${state.config.wsBaseUrl}/${state.listenKey}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectAttempt = 0
        state.clock.sync(Date.now()) // Approximate sync
      }

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data)
      }

      this.ws.onclose = () => {
        if (this.shouldReconnect) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = () => {
        // onclose will fire after onerror
      }
    } catch {
      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    }
  }

  private handleMessage(raw: string): void {
    const state = this.owner.state
    try {
      const msg = JSON.parse(raw)
      const eventType = msg.e

      switch (eventType) {
        case 'executionReport': {
          this.handleExecutionReport(msg, state)
          break
        }
        case 'balanceUpdate': {
          this.handleBalanceUpdate(msg, state)
          break
        }
        case 'outboundAccountPosition': {
          this.handleAccountPosition(msg, state)
          break
        }
        // 'listStatus' for OCO orders — can be added later
      }
    } catch {
      // Malformed message — ignore
    }
  }

  private handleExecutionReport(msg: any, state: BinanceSpotState): void {
    const order: BrokerOrder = {
      brokerOrderId: msg.i,                // orderId
      clientOrderId: msg.c,                // clientOrderId (original)
      symbol: msg.s,
      side: msg.S?.toLowerCase() === 'buy' ? 'buy' : 'sell',
      type: msg.o,
      status: mapBinanceOrderStatus(msg.X ?? msg.x),
      quantity: parseFloat(msg.q ?? '0'),
      filledQuantity: parseFloat(msg.z ?? '0'),
      price: msg.p ? parseFloat(msg.p) : undefined,
      stopPrice: msg.P ? parseFloat(msg.P) : undefined,
      averagePrice: parseFloat(msg.Z ?? '0') / (parseFloat(msg.z ?? '1') || 1),
      commission: parseFloat(msg.n ?? '0'),
      commissionAsset: msg.N,
      timeInForce: msg.f,
      createdAt: msg.T,
      updatedAt: msg.T,
    }

    // Notify order handlers
    for (const h of state.orderHandlers) h({ ...order })

    // If this is a fill, also notify fill handlers
    if (msg.X === 'FILLED' || msg.x === 'TRADE') {
      const fill: BrokerFill = {
        id: `${msg.i}-${msg.t}`,
        orderId: msg.c ?? msg.i,
        brokerOrderId: msg.i,
        symbol: msg.s,
        side: msg.S?.toLowerCase() === 'buy' ? 'buy' : 'sell',
        quantity: parseFloat(msg.l ?? msg.z ?? '0'),
        price: parseFloat(msg.L ?? msg.p ?? '0'),
        commission: parseFloat(msg.n ?? '0'),
        commissionAsset: msg.N,
        realizedPnl: msg.l ? undefined : undefined, // Execution report has per-fill data
        timestamp: msg.T ?? msg.E,
      }
      for (const h of state.fillHandlers) h({ ...fill })
    }
  }

  private handleBalanceUpdate(msg: any, state: BinanceSpotState): void {
    // Single asset balance delta: { "a": "BTC", "d": "100", "T": 123456 }
    // We don't have full balance state here, so we rely on outboundAccountPosition
    // or periodic REST poll for full balance sync
  }

  private async handleAccountPosition(msg: any, state: BinanceSpotState): Promise<void> {
    // Full account balances: { "B": [{"a":"BTC","f":"10000","l":"0"}, ...], "E": 123456 }
    const balances: Record<string, BrokerBalance> = {}
    if (Array.isArray(msg.B)) {
      for (const b of msg.B) {
        const asset = b.a
        balances[asset] = {
          asset,
          free: parseFloat(b.f ?? '0'),
          locked: parseFloat(b.l ?? '0'),
          total: parseFloat(b.f ?? '0') + parseFloat(b.l ?? '0'),
        }
      }
    }
    for (const h of state.balanceHandlers) h({ ...balances })
  }

  private scheduleReconnect(): void {
    const state = this.owner.state
    this.reconnectAttempt++
    if (this.reconnectAttempt > state.config.maxWsReconnectAttempts) return

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connectWebSocket()
      }
    }, state.config.wsReconnectDelayMs * Math.min(this.reconnectAttempt, 5))
  }

  private reconnectWebSocket(): void {
    this.closeWebSocket()
    this.connectWebSocket()
  }

  private closeWebSocket(): void {
    if (this.ws) {
      try { this.ws.close() } catch { /* ignore */ }
      this.ws = null
    }
  }
}

// ═══════════════════════════════════════════════
// Symbol Filter Validator
// ═══════════════════════════════════════════════

export class BinanceSymbolFilterValidator {
  private owner: BinanceSpotBrokerAdapter

  constructor(owner: BinanceSpotBrokerAdapter) {
    this.owner = owner
  }

  async loadFilters(symbol?: string): Promise<void> {
    const state = this.owner.state
    const data = await publicRequest(state, '/api/v3/exchangeInfo', symbol ? { symbol } : {})
    const map = new Map<string, BinanceSymbolFilterInfo>()

    for (const s of data.symbols) {
      map.set(s.symbol, {
        symbol: s.symbol,
        status: s.status,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        filters: s.filters,
      })
    }
    state.symbolFilters = map
  }

  validate(params: BrokerPlacementParams, symbolInfo: BinanceSymbolFilterInfo): void {
    const qty = params.quantity
    const price = params.price ?? 0

    for (const f of symbolInfo.filters) {
      switch (f.filterType) {
        case 'LOT_SIZE': {
          const step = parseFloat(f.stepSize)
          const min = parseFloat(f.minQty)
          const max = parseFloat(f.maxQty)

          if (qty < min) throw new ValidationError(`Quantity ${qty} < min lot size ${min}`)
          if (qty > max) throw new ValidationError(`Quantity ${qty} > max lot size ${max}`)

          // Round to stepSize precision
          const rounded = Math.floor(qty / step) * step
          if (Math.abs(rounded - qty) > 1e-8) {
            throw new ValidationError(
              `Quantity ${qty} not aligned to step size ${step}. Suggested: ${rounded.toFixed(decimalPlaces(step))}`,
            )
          }
          break
        }
        case 'PRICE_FILTER': {
          const tick = parseFloat(f.tickSize)
          const min = parseFloat(f.minPrice)
          const max = parseFloat(f.maxPrice)

          if (price < min) throw new ValidationError(`Price ${price} < min price ${min}`)
          if (price > max) throw new ValidationError(`Price ${price} > max price ${max}`)

          const aligned = Math.round(price / tick) * tick
          if (Math.abs(aligned - price) > 1e-8) {
            throw new ValidationError(
              `Price ${price} not aligned to tick size ${tick}. Suggested: ${aligned.toFixed(decimalPlaces(tick))}`,
            )
          }
          break
        }
        case 'MIN_NOTIONAL': {
          const minNotional = parseFloat(f.minNotional)
          const notional = price > 0 ? qty * price : qty * (params.type === 'MARKET' ? 1 : price)
          if (notional < minNotional) {
            throw new ValidationError(`Notional ${notional} < min notional ${minNotional}`)
          }
          break
        }
      }
    }
  }

  getSymbolInfo(symbol: string): BinanceSymbolFilterInfo | undefined {
    return this.owner.state.symbolFilters?.get(symbol)
  }
}

function decimalPlaces(n: number): number {
  const s = String(n)
  const dot = s.indexOf('.')
  return dot >= 0 ? s.length - dot - 1 : 0
}

// ═══════════════════════════════════════════════
// Connection
// ═══════════════════════════════════════════════

class BinanceSpotConnectionAdapter implements ConnectionAdapter {
  private owner: BinanceSpotBrokerAdapter

  constructor(owner: BinanceSpotBrokerAdapter) {
    this.owner = owner
  }

  async connect(): Promise<void> {
    const state = this.owner.state

    // Validate credentials
    if (!state.config.apiKey || !state.config.apiSecret) {
      throw new AuthenticationError('Binance Spot: API key and secret required')
    }

    // Fetch server time for clock sync
    try {
      const timeData = await publicRequest(state, '/api/v3/time')
      state.clock.sync(timeData.serverTime)
    } catch {
      // Continue with local time if server time fetch fails
    }

    // Verify connectivity by fetching account info
    try {
      await signedRequest(state, 'GET', '/api/v3/account', { omitZeroBalances: 'true' })
    } catch (err) {
      state.connected = false
      throw err
    }

    // Load symbol filters
    try {
      await this.owner.filterValidator.loadFilters()
    } catch {
      // Non-critical — continue without filters
    }

    // Start user data stream
    try {
      await this.owner.userDataStream.start()
    } catch {
      // Non-critical — order/balance subscriptions will rely on REST polling
    }

    state.connected = true
  }

  async disconnect(): Promise<void> {
    const state = this.owner.state
    this.owner.userDataStream.stop()
    state.connected = false
  }

  isConnected(): boolean {
    return this.owner.state.connected
  }

  async getServerTime(): Promise<number> {
    const data = await publicRequest(this.owner.state, '/api/v3/time')
    return data.serverTime
  }
}

// ═══════════════════════════════════════════════
// Orders
// ═══════════════════════════════════════════════

class BinanceSpotOrderAdapter implements OrderAdapter {
  private owner: BinanceSpotBrokerAdapter

  constructor(owner: BinanceSpotBrokerAdapter) {
    this.owner = owner
  }

  subscribeOrders(handler: (order: BrokerOrder) => void): () => void {
    this.owner.state.orderHandlers.push(handler)
    return () => {
      const idx = this.owner.state.orderHandlers.indexOf(handler)
      if (idx >= 0) this.owner.state.orderHandlers.splice(idx, 1)
    }
  }

  subscribeFills(handler: (fill: BrokerFill) => void): () => void {
    this.owner.state.fillHandlers.push(handler)
    return () => {
      const idx = this.owner.state.fillHandlers.indexOf(handler)
      if (idx >= 0) this.owner.state.fillHandlers.splice(idx, 1)
    }
  }

  async placeOrder(params: BrokerPlacementParams): Promise<BrokerOrder> {
    const state = this.owner.state
    this.ensureConnected()

    // Validate against symbol filters
    const symbolInfo = this.owner.filterValidator.getSymbolInfo(params.symbol)
    if (symbolInfo) {
      this.owner.filterValidator.validate(params, symbolInfo)
    }

    const binanceSide = params.side === 'buy' ? 'BUY' : 'SELL'
    const body: Record<string, string | number> = {
      symbol: params.symbol,
      side: binanceSide,
      type: params.type.toUpperCase(),
      quantity: params.quantity,
    }

    if (params.type.toUpperCase() !== 'MARKET') {
      if (params.price !== undefined) body.price = params.price
      if (params.timeInForce) body.timeInForce = params.timeInForce
    }
    if (params.stopPrice !== undefined) body.stopPrice = params.stopPrice
    if (params.clientOrderId) body.newClientOrderId = params.clientOrderId

    const result = await signedRequest(state, 'POST', '/api/v3/order', body)

    return this.normalizeOrder(result)
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const state = this.owner.state
    this.ensureConnected()

    try {
      // Try cancelling by brokerOrderId first, then by clientOrderId
      await signedRequest(state, 'DELETE', '/api/v3/order', { orderId, symbol: '' })
      return true
    } catch (err) {
      if (err instanceof ExchangeRejectedError && err.exchangeCode?.includes('-2011')) {
        return false // Unknown order
      }
      throw err
    }
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    const state = this.owner.state
    this.ensureConnected()
    const orders = await this.getOpenOrders(symbol)
    let count = 0
    for (const order of orders) {
      try {
        await signedRequest(state, 'DELETE', '/api/v3/order', {
          symbol: order.symbol,
          orderId: order.brokerOrderId,
        })
        count++
      } catch {
        // Continue cancelling remaining orders
      }
    }
    return count
  }

  async replaceOrder(
    orderId: string,
    params: Partial<BrokerPlacementParams>,
  ): Promise<BrokerOrder> {
    const state = this.owner.state
    this.ensureConnected()

    // Binance doesn't support true replace. Cancel + place new.
    const existing = await this.getOrder(orderId)
    if (!existing) throw new ValidationError(`Order ${orderId} not found`)

    await this.cancelOrder(orderId)

    const newParams: BrokerPlacementParams = {
      symbol: params.symbol ?? existing.symbol,
      side: params.side ?? existing.side,
      type: params.type ?? existing.type,
      quantity: params.quantity ?? existing.quantity,
      price: params.price ?? existing.price,
      stopPrice: params.stopPrice ?? existing.stopPrice,
      timeInForce: params.timeInForce ?? existing.timeInForce ?? 'GTC',
      clientOrderId: `${orderId}-replace`,
    }

    return this.placeOrder(newParams)
  }

  async getOrder(orderId: string): Promise<BrokerOrder | null> {
    const state = this.owner.state
    this.ensureConnected()

    try {
      const result = await signedRequest(state, 'GET', '/api/v3/order', { orderId })
      return this.normalizeOrder(result)
    } catch {
      return null
    }
  }

  async getOpenOrders(symbol?: string): Promise<BrokerOrder[]> {
    const state = this.owner.state
    this.ensureConnected()

    const params: Record<string, string | number> = {}
    if (symbol) params.symbol = symbol

    const results = await signedRequest(state, 'GET', '/api/v3/openOrders', params)
    return (Array.isArray(results) ? results : []).map((r: any) => this.normalizeOrder(r))
  }

  async getOrderHistory(symbol: string, limit = 50): Promise<BrokerOrder[]> {
    const state = this.owner.state
    this.ensureConnected()

    const results = await signedRequest(state, 'GET', '/api/v3/allOrders', {
      symbol,
      limit,
    })
    return (Array.isArray(results) ? results : []).map((r: any) => this.normalizeOrder(r))
  }

  private normalizeOrder(raw: any): BrokerOrder {
    return {
      brokerOrderId: String(raw.orderId),
      clientOrderId: raw.clientOrderId,
      symbol: raw.symbol,
      side: raw.side?.toLowerCase() === 'buy' ? 'buy' : 'sell',
      type: raw.type,
      status: mapBinanceOrderStatus(raw.status),
      quantity: parseFloat(raw.origQty ?? '0'),
      filledQuantity: parseFloat(raw.executedQty ?? '0'),
      price: raw.price ? parseFloat(raw.price) : undefined,
      stopPrice: raw.stopPrice ? parseFloat(raw.stopPrice) : undefined,
      averagePrice: parseFloat(raw.cummulativeQuoteQty ?? '0') / (parseFloat(raw.executedQty ?? '1') || 1),
      commission: parseFloat(raw.commission ?? '0'),
      commissionAsset: raw.commissionAsset,
      timeInForce: raw.timeInForce,
      reduceOnly: undefined,
      createdAt: raw.time,
      updatedAt: raw.updateTime ?? raw.time,
    }
  }

  private ensureConnected(): void {
    if (!this.owner.state.connected) {
      throw new BrokerError('Binance Spot: not connected', 'NOT_CONNECTED')
    }
  }
}

// ═══════════════════════════════════════════════
// Positions (Spot — not applicable)
// ═══════════════════════════════════════════════

class BinanceSpotPositionAdapter implements PositionAdapter {
  subscribePositions(_handler: (pos: BrokerPosition) => void): () => void {
    // Spot exchange has no positions
    return () => {}
  }

  async getPositions(_symbol?: string): Promise<BrokerPosition[]> {
    return []
  }

  async getPosition(_symbol: string): Promise<BrokerPosition | null> {
    return null
  }
}

// ═══════════════════════════════════════════════
// Account
// ═══════════════════════════════════════════════

class BinanceSpotAccountAdapter implements AccountAdapter {
  private owner: BinanceSpotBrokerAdapter

  constructor(owner: BinanceSpotBrokerAdapter) {
    this.owner = owner
  }

  subscribeBalances(handler: (balances: Record<string, BrokerBalance>) => void): () => void {
    this.owner.state.balanceHandlers.push(handler)
    return () => {
      const idx = this.owner.state.balanceHandlers.indexOf(handler)
      if (idx >= 0) this.owner.state.balanceHandlers.splice(idx, 1)
    }
  }

  async getBalances(): Promise<Record<string, BrokerBalance>> {
    const state = this.owner.state
    const info = await signedRequest(state, 'GET', '/api/v3/account', { omitZeroBalances: 'true' })

    const balances: Record<string, BrokerBalance> = {}
    if (Array.isArray(info.balances)) {
      for (const b of info.balances) {
        const free = parseFloat(b.free ?? '0')
        const locked = parseFloat(b.locked ?? '0')
        if (free > 0 || locked > 0) {
          balances[b.asset] = {
            asset: b.asset,
            free,
            locked,
            total: free + locked,
          }
        }
      }
    }
    return balances
  }

  async getAccountInfo(): Promise<BrokerAccountInfo> {
    const state = this.owner.state
    const info = await signedRequest(state, 'GET', '/api/v3/account', { omitZeroBalances: 'true' })

    const balances: Record<string, BrokerBalance> = {}
    let totalEquity = 0

    if (Array.isArray(info.balances)) {
      for (const b of info.balances) {
        const free = parseFloat(b.free ?? '0')
        const locked = parseFloat(b.locked ?? '0')
        const total = free + locked
        if (free > 0 || locked > 0) {
          balances[b.asset] = { asset: b.asset, free, locked, total }
          totalEquity += total
        }
      }
    }

    return {
      balances,
      totalEquity,
      unrealizedPnl: 0, // Spot has no unrealized PnL
      canTrade: info.canTrade ?? true,
      isTestnet: state.config.testnet,
    }
  }
}

// ═══════════════════════════════════════════════
// Status mapping
// ═══════════════════════════════════════════════

function mapBinanceOrderStatus(binanceStatus: string): string {
  const map: Record<string, string> = {
    NEW: 'NEW',
    PARTIALLY_FILLED: 'PARTIALLY_FILLED',
    FILLED: 'FILLED',
    CANCELED: 'CANCELLED',
    PENDING_CANCEL: 'PENDING_CANCEL',
    REJECTED: 'REJECTED',
    EXPIRED: 'EXPIRED',
    EXPIRED_IN_MATCH: 'EXPIRED',
  }
  return map[binanceStatus] ?? binanceStatus
}
