/**
 * BybitBrokerAdapter.ts — Bybit v5 broker adapter (Linear USDT Perpetual)
 *
 * Full BrokerAdapter implementation for Bybit v5 REST + Private WebSocket.
 *
 * Architecture:
 *   BybitBrokerAdapter
 *     ├── BybitConnectionAdapter  — connect/disconnect, serverTime, clock sync
 *     ├── BybitOrderAdapter       — REST orders + Private WS order/execution subscriptions
 *     ├── BybitPositionAdapter    — REST positions + Private WS position subscriptions
 *     ├── BybitAccountAdapter     — REST balances + Private WS wallet subscriptions
 *     └── BybitPrivateWsClient    — authenticated WS session, reconnect, heartbeat
 *
 * Supported categories: linear (USDT perpetual)
 *
 * @since 4.9E
 */

import type {
  BrokerAdapter,
  ConnectionAdapter,
  OrderAdapter,
  PositionAdapter,
  AccountAdapter,
} from '../live/BrokerAdapter'
import { BYBIT_CAPABILITIES } from '../live/BrokerCapabilities'
import type { BrokerCapabilities } from '../live/BrokerCapabilities'
import type {
  BrokerOrder,
  BrokerPosition,
  BrokerBalance,
  BrokerAccountInfo,
  BrokerFill,
  BrokerPlacementParams,
} from '../live/types'
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
import { NativeWebSocketFactory } from '../../../runtime/chaos/index.ts'
import type { IWebSocketFactory } from '../../../runtime/chaos/index.ts'

// ═══════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════

const REST_MAINNET = 'https://api.bybit.com'
const REST_TESTNET = 'https://api-testnet.bybit.com'
const WS_PRIVATE_MAINNET = 'wss://stream.bybit.com/v5/private'
const WS_PRIVATE_TESTNET = 'wss://stream-testnet.bybit.com/v5/private'

const DEFAULT_RECV_WINDOW = 5_000
const DEFAULT_WS_RECONNECT_DELAY = 2_000
const DEFAULT_WS_MAX_RECONNECT = 20
const AUTH_EXPIRY_MS = 10_000 // Private WS auth valid window
const PING_INTERVAL_MS = 20_000
const TIMESTAMP_SYNC_INTERVAL_MS = 300_000 // 5 min

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export interface BybitConfig {
  apiKey?: string
  apiSecret?: string
  testnet?: boolean
  recvWindow?: number
  wsReconnectDelayMs?: number
  maxWsReconnectAttempts?: number
  restBaseUrl?: string
  wsPrivateUrl?: string
}

interface BybitState {
  connected: boolean
  config: Required<BybitConfig>
  clock: BrokerClock

  // REST client state
  fetchFn: typeof globalThis.fetch
  lastServerTimeSync: number

  // Private WS
  privateWs: BybitPrivateWsClient | null
  wsFactory: IWebSocketFactory

  // Subscriber lists
  orderHandlers: Array<(order: BrokerOrder) => void>
  fillHandlers: Array<(fill: BrokerFill) => void>
  positionHandlers: Array<(pos: BrokerPosition) => void>
  balanceHandlers: Array<(balances: Record<string, BrokerBalance>) => void>

  // Exchange rules cache (loaded on connect)
  symbolInfo: Map<string, BybitInstrumentInfo> | null
}

// ═══════════════════════════════════════════════
// Exchange Rules Types
// ═══════════════════════════════════════════════

export interface BybitLotSizeFilter {
  minOrderQty: string
  maxOrderQty: string
  qtyStep: string
}

export interface BybitPriceFilter {
  tickSize: string
  minPrice: string
  maxPrice: string
}

export interface BybitInstrumentInfo {
  symbol: string
  status: string
  lotSizeFilter: BybitLotSizeFilter
  priceFilter: BybitPriceFilter
  minNotionalValue: string
}

// ═══════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════

const DEFAULTS: Required<Omit<BybitConfig, 'apiKey' | 'apiSecret'>> = {
  testnet: false,
  recvWindow: DEFAULT_RECV_WINDOW,
  wsReconnectDelayMs: DEFAULT_WS_RECONNECT_DELAY,
  maxWsReconnectAttempts: DEFAULT_WS_MAX_RECONNECT,
  restBaseUrl: REST_MAINNET,
  wsPrivateUrl: WS_PRIVATE_MAINNET,
}

// ═══════════════════════════════════════════════
// HMAC-SHA256 Signing
// ═══════════════════════════════════════════════

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
// Bybit API Error Classifier
// ═══════════════════════════════════════════════

interface BybitApiResponse {
  retCode: number
  retMsg: string
  result: unknown
}

function classifyBybitError(retCode: number, retMsg: string): BrokerError {
  switch (retCode) {
    case 0:
      return new BrokerError('OK')
    case 10004:
    case 10005:
    case 10006:
      return new AuthenticationError(`Bybit auth error [${retCode}]: ${retMsg}`)
    case 10003:
      return new ValidationError(`Bybit param error [${retCode}]: ${retMsg}`)
    case 10028:
      return new RateLimitError(`Bybit rate limited [${retCode}]: ${retMsg}`)
    case 110001:
      return new ValidationError(`Bybit order not found [${retCode}]: ${retMsg}`)
    default:
      if (retCode >= 10000 && retCode < 20000) {
        return new ExchangeRejectedError(`Bybit rejected [${retCode}]: ${retMsg}`)
      }
      return new BrokerError(`Bybit error [${retCode}]: ${retMsg}`)
  }
}

function parseBybitResponse<T>(body: string): T {
  let parsed: BybitApiResponse
  try {
    parsed = JSON.parse(body) as BybitApiResponse
  } catch {
    throw new NetworkError(`Bybit non-JSON response: ${body.slice(0, 200)}`)
  }
  if (parsed.retCode !== 0) {
    throw classifyBybitError(parsed.retCode, parsed.retMsg)
  }
  return parsed.result as T
}

// ═══════════════════════════════════════════════
// Exchange Rules Helpers
// ═══════════════════════════════════════════════

/**
 * Fetch and cache instruments-info for all subscribed symbols.
 * Called on connect to ensure exchange rules are available.
 */
async function fetchInstruments(state: BybitState, symbols: string[]): Promise<void> {
  const map = new Map<string, BybitInstrumentInfo>()
  const baseUrl = state.config.restBaseUrl

  // Fetch all at once (supports symbol filter for smaller response)
  for (const symbol of symbols) {
    try {
      const url = `${baseUrl}/v5/market/instruments-info?category=linear&symbol=${symbol}`
      const res = await state.fetchFn(url, { signal: AbortSignal.timeout(10_000) })
      const text = await res.json()
      if (text.retCode !== 0) continue
      const list = text.result?.list ?? []
      for (const item of list) {
        map.set(item.symbol, {
          symbol: item.symbol,
          status: item.status ?? 'Trading',
          lotSizeFilter: {
            minOrderQty: item.lotSizeFilter?.minOrderQty ?? '0',
            maxOrderQty: item.lotSizeFilter?.maxOrderQty ?? '999999',
            qtyStep: item.lotSizeFilter?.qtyStep ?? '0.0001',
          },
          priceFilter: {
            tickSize: item.priceFilter?.tickSize ?? '0.01',
            minPrice: item.priceFilter?.minPrice ?? '0',
            maxPrice: item.priceFilter?.maxPrice ?? '999999',
          },
          minNotionalValue: item.lotSizeFilter?.minNotionalValue ?? '5',
        })
      }
    } catch {
      // Non-fatal — continue without cached info
    }
  }
  state.symbolInfo = map
}

/**
 * Validate order params against exchange rules before sending.
 * Throws ValidationError if any rule is violated.
 */
function validateOrder(
  symbolInfo: BybitInstrumentInfo,
  params: BrokerPlacementParams,
): void {
  const qty = params.quantity
  const price = params.price ?? 0
  const ls = symbolInfo.lotSizeFilter
  const pf = symbolInfo.priceFilter
  const minNotional = parseFloat(symbolInfo.minNotionalValue)

  // Lot size
  const minQty = parseFloat(ls.minOrderQty)
  const maxQty = parseFloat(ls.maxOrderQty)
  const qtyStep = parseFloat(ls.qtyStep)

  if (qty < minQty) {
    throw new ValidationError(
      `[${params.symbol}] Quantity ${qty} < min lot size ${minQty}`,
    )
  }
  if (qty > maxQty) {
    throw new ValidationError(
      `[${params.symbol}] Quantity ${qty} > max lot size ${maxQty}`,
    )
  }

  // Round to qtyStep precision (Math.floor to avoid rounding up)
  const alignedQty = Math.floor(qty / qtyStep) * qtyStep
  if (Math.abs(alignedQty - qty) > 1e-8) {
    throw new ValidationError(
      `[${params.symbol}] Quantity ${qty} not aligned to qty step ${qtyStep}. Suggested: ${alignedQty}`,
    )
  }

  // Price filter
  const tickSize = parseFloat(pf.tickSize)
  const minPrice = parseFloat(pf.minPrice)
  const maxPrice = parseFloat(pf.maxPrice)

  if (price > 0) {
    if (price < minPrice) {
      throw new ValidationError(
        `[${params.symbol}] Price ${price} < min price ${minPrice}`,
      )
    }
    if (price > maxPrice) {
      throw new ValidationError(
        `[${params.symbol}] Price ${price} > max price ${maxPrice}`,
      )
    }

    const alignedPrice = Math.round(price / tickSize) * tickSize
    if (Math.abs(alignedPrice - price) > 1e-8) {
      throw new ValidationError(
        `[${params.symbol}] Price ${price} not aligned to tick size ${tickSize}. Suggested: ${alignedPrice}`,
      )
    }
  }

  // Min notional (for limit/market orders)
  if (price > 0) {
    const notional = qty * price
    if (notional < minNotional) {
      throw new ValidationError(
        `[${params.symbol}] Notional ${notional} < min notional ${minNotional}. Minimum order qty: ${(minNotional / price).toFixed(4)}`,
      )
    }
  }
}

/**
 * Count decimal places in a number string.
 */
function decimalPlaces(n: number): number {
  const s = String(n)
  const dot = s.indexOf('.')
  return dot >= 0 ? s.length - dot - 1 : 0
}

// ═══════════════════════════════════════════════
// REST Client
// ═══════════════════════════════════════════════

async function signedRequest<T>(
  state: BybitState,
  method: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const timestamp = state.clock.now()
  const apiKey = state.config.apiKey!
  const apiSecret = state.config.apiSecret!
  const recvWindow = state.config.recvWindow

  // Build query string for GET, JSON body for POST
  const isGet = method === 'GET'

  // Build query string first (needed for both URL and GET signature)
  const queryString = isGet && params
    ? '?' + Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''

  // Build JSON body for POST
  const body: Record<string, unknown> = {}
  if (params && !isGet) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) body[k] = v
    }
  }

  // Bybit v5 signature: timestamp + apiKey + recvWindow + payload
  // For GET: payload = query string (without leading '?')
  // For POST: payload = JSON body
  const payload = isGet
    ? queryString.slice(1)
    : JSON.stringify(body)

  const signData = `${timestamp}${apiKey}${recvWindow}${payload}`
  const signature = await hmacSha256(apiSecret, signData)

  const url = `${state.config.restBaseUrl}${path}${queryString}`

  const headers: Record<string, string> = {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': String(timestamp),
    'X-BAPI-SIGN': signature,
    'X-BAPI-RECV-WINDOW': String(recvWindow),
  }
  if (!isGet) {
    headers['Content-Type'] = 'application/json'
  }

  let res: Response
  try {
    res = await state.fetchFn(url, {
      method,
      headers,
      body: isGet ? undefined : payload,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw new NetworkError(`Bybit network error: ${String(err)}`)
  }

  const text = await res.text()

  // Sync clock from server response headers
  const serverTimeHeader = res.headers.get('X-BAPI-TIMESTAMP')
  if (serverTimeHeader) {
    const serverTime = parseInt(serverTimeHeader, 10)
    if (!isNaN(serverTime)) {
      state.clock.sync(serverTime)
    }
  }

  if (res.status === 429) {
    throw new RateLimitError(`Bybit rate limit: ${text.slice(0, 200)}`)
  }

  return parseBybitResponse<T>(text)
}

async function publicRequest<T>(method: string, url: string, state?: BybitState): Promise<T> {
  const fetchFn = state?.fetchFn ?? fetch
  let res: Response
  try {
    res = await fetchFn(url, {
      method,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw new NetworkError(`Bybit network error: ${String(err)}`)
  }
  const text = await res.text()
  return parseBybitResponse<T>(text)
}

// ═══════════════════════════════════════════════
// Type Mappers
// ═══════════════════════════════════════════════

interface BybitOrderResult {
  orderId: string
  orderLinkId: string
}

interface BybitOrderRecord {
  orderId: string
  orderLinkId: string
  symbol: string
  side: 'Buy' | 'Sell'
  orderType: 'Market' | 'Limit' | 'Stop' | 'StopLimit'
  price: string
  qty: string
  cumExecQty: string
  cumExecValue: string
  cumExecFee: string
  orderStatus:
    | 'Created'
    | 'New'
    | 'Rejected'
    | 'PartiallyFilled'
    | 'Filled'
    | 'Cancelled'
    | 'PendingCancel'
    | 'Untriggered'
    | 'Deactivated'
    | 'Triggered'
    | 'Active'
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'PostOnly'
  createdTime: string
  updatedTime: string
  stopLoss?: string
  takeProfit?: string
  reduceOnly: boolean
  positionIdx: number
}

interface BybitPositionRecord {
  symbol: string
  side: 'Buy' | 'Sell'
  size: string
  avgPrice: string
  unrealisedPnl: string
  cumRealisedPnl: string
  createdTime: string
  updatedTime: string
  positionIdx: number
  positionStatus: 'Normal' | 'LiqWatch' | 'Adl' | 'Md'
  leverage: string
  autoAddMargin: number
  tradeMode: 0 | 1
  liqPrice?: string
  bustPrice?: string
}

interface BybitWalletBalance {
  coin: string
  walletBalance: string
  availableToWithdraw: string
  locked: string
}

interface BybitAccountInfo {
  unifyStatus: number
  marginMode: string
}

function mapBybitOrderStatus(status: string): BrokerOrder['status'] {
  switch (status) {
    case 'Created':
    case 'New':
    case 'Untriggered':
    case 'Active':
      return 'open'
    case 'PartiallyFilled':
      return 'partially_filled'
    case 'Filled':
      return 'filled'
    case 'Cancelled':
    case 'PendingCancel':
    case 'Deactivated':
      return 'cancelled'
    case 'Rejected':
      return 'rejected'
    default:
      return 'unknown'
  }
}

function mapBybitOrder(rec: BybitOrderRecord, _adapterId: string): BrokerOrder {
  const executedQty = parseFloat(rec.cumExecQty)
  const totalQty = parseFloat(rec.qty)
  const executedValue = parseFloat(rec.cumExecValue)
  return {
    brokerOrderId: rec.orderId,
    clientOrderId: rec.orderLinkId || undefined,
    symbol: rec.symbol,
    side: rec.side.toLowerCase() === 'buy' ? 'buy' : 'sell',
    type: rec.orderType.toLowerCase(),
    price: parseFloat(rec.price),
    quantity: totalQty,
    filledQuantity: executedQty,
    averagePrice: executedQty > 0 ? executedValue / executedQty : 0,
    commission: parseFloat(rec.cumExecFee),
    commissionAsset: undefined,
    stopPrice: parseFloat(rec.stopLoss ?? '0') || undefined,
    timeInForce: rec.timeInForce,
    reduceOnly: rec.reduceOnly,
    status: mapBybitOrderStatus(rec.orderStatus),
    createdAt: parseInt(rec.createdTime, 10),
    updatedAt: parseInt(rec.updatedTime, 10),
  }
}

function mapBybitPosition(rec: BybitPositionRecord): BrokerPosition {
  const size = Math.abs(parseFloat(rec.size))
  return {
    symbol: rec.symbol,
    direction: parseFloat(rec.size) > 0 ? 'long' : 'short',
    quantity: size,
    averageEntryPrice: parseFloat(rec.avgPrice),
    currentPrice: parseFloat(rec.avgPrice),
    unrealizedPnl: parseFloat(rec.unrealisedPnl),
    realizedPnl: parseFloat(rec.cumRealisedPnl),
    leverage: parseFloat(rec.leverage),
    liquidationPrice: rec.liqPrice ? parseFloat(rec.liqPrice) : undefined,
    updatedAt: parseInt(rec.updatedTime, 10),
  }
}

function mapBybitBalance(bal: BybitWalletBalance): BrokerBalance {
  return {
    asset: bal.coin,
    free: parseFloat(bal.availableToWithdraw),
    locked: parseFloat(bal.locked),
    total: parseFloat(bal.walletBalance),
  }
}

// ═══════════════════════════════════════════════
// Private WebSocket Client
// ═══════════════════════════════════════════════

type WsState = 'idle' | 'connecting' | 'open' | 'closing' | 'closed'

class BybitPrivateWsClient {
  private state_: WsState = 'idle'
  private ws: WebSocket | null = null
  private config: Required<BybitConfig>
  private wsFactory: IWebSocketFactory
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private manualDisconnect = false

  private pendingSubscriptions: string[] = []
  private isSubscribed = false

  // Callbacks
  onOrder: ((order: BrokerOrder) => void) | null = null
  onFill: ((fill: BrokerFill) => void) | null = null
  onPosition: ((pos: BrokerPosition) => void) | null = null
  onBalance: ((balances: Record<string, BrokerBalance>) => void) | null = null
  onError: ((err: Error) => void) | null = null
  onReconnect: (() => void) | null = null

  private adapterId: string

  constructor(
    config: Required<BybitConfig>,
    adapterId: string,
    wsFactory?: IWebSocketFactory,
  ) {
    this.config = config
    this.adapterId = adapterId
    this.wsFactory = wsFactory ?? new NativeWebSocketFactory()
  }

  get state(): WsState {
    return this.state_
  }

  get isConnected(): boolean {
    return this.state_ === 'open'
  }

  async connect(): Promise<void> {
    if (this.state_ === 'open' || this.state_ === 'connecting') return
    this.manualDisconnect = false
    this.state_ = 'connecting'

    return new Promise<void>((resolve, reject) => {
      const url = this.config.wsPrivateUrl
      const ws = this.wsFactory.createWebSocket(url)
      this.ws = ws

      ws.onopen = async () => {
        try {
          await this.authenticate()
          await this.subscribeTopics()
          this.state_ = 'open'
          this.reconnectAttempt = 0
          this.startPing()
          this.isSubscribed = true
          this.onReconnect?.()
          resolve()
        } catch (err) {
          this.state_ = 'closed'
          reject(err)
        }
      }

      ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data as string)
      }

      ws.onerror = () => {
        if (!this.manualDisconnect) {
          this.scheduleReconnect()
        }
      }

      ws.onclose = () => {
        this.state_ = 'closed'
        this.stopPing()
        if (!this.manualDisconnect) {
          this.scheduleReconnect()
        }
      }

      // Timeout connect after 15s
      setTimeout(() => {
        if (this.state_ === 'connecting') {
          ws.close()
          reject(new NetworkError('Bybit WS connect timeout'))
        }
      }, 15_000)
    })
  }

  disconnect(): void {
    this.manualDisconnect = true
    this.cancelReconnect()
    this.stopPing()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state_ = 'closed'
    this.isSubscribed = false
  }

  private async authenticate(): Promise<void> {
    const apiKey = this.config.apiKey!
    const apiSecret = this.config.apiSecret!
    const expires = Date.now() + AUTH_EXPIRY_MS
    const signData = `GET/realtime${expires}`
    const signature = await hmacSha256(apiSecret, signData)

    const authMsg = {
      op: 'auth',
      args: [apiKey, expires, signature],
    }

    this.ws!.send(JSON.stringify(authMsg))

    // Wait for auth success
    return new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.op === 'auth') {
            if (msg.success === true) {
              this.ws!.removeEventListener('message', handler)
              resolve()
            } else {
              this.ws!.removeEventListener('message', handler)
              reject(new AuthenticationError(`Bybit WS auth failed: ${msg.ret_msg || 'unknown'}`))
            }
          }
        } catch { /* skip non-JSON messages */ }
      }
      this.ws!.addEventListener('message', handler)

      setTimeout(() => {
        this.ws!.removeEventListener('message', handler)
        reject(new AuthenticationError('Bybit WS auth timeout'))
      }, 10_000)
    })
  }

  private async subscribeTopics(): Promise<void> {
    const topics = [...new Set([
      'order',
      'execution',
      'position',
      'wallet',
      ...this.pendingSubscriptions,
    ])]

    return new Promise<void>((resolve) => {
      const subMsg = {
        op: 'subscribe',
        args: topics,
      }
      this.ws!.send(JSON.stringify(subMsg))

      // Wait for subscription response
      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.op === 'subscribe') {
            this.ws!.removeEventListener('message', handler)
            resolve()
          }
        } catch { /* skip */ }
      }
      this.ws!.addEventListener('message', handler)

      // Timeout — subscriptions may partially fail, continue anyway
      setTimeout(() => {
        this.ws!.removeEventListener('message', handler)
        resolve()
      }, 5_000)
    })
  }

  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data)

      // Ping/pong response
      if (msg.op === 'pong') return

      // Topic data
      if (msg.type === 'snapshot' || msg.type === 'delta') {
        const topic = msg.topic as string
        const data = msg.data

        switch (topic) {
          case 'order': {
            const orders = Array.isArray(data) ? data : [data]
            for (const rec of orders) {
              if (this.onOrder) {
                this.onOrder(mapBybitOrder(rec as BybitOrderRecord, this.adapterId))
              }
            }
            break
          }
          case 'execution': {
            const fills = Array.isArray(data) ? data : [data]
            for (const rec of fills) {
              if (this.onFill) {
                this.onFill(this.mapBybitFill(rec))
              }
            }
            break
          }
          case 'position': {
            const positions = Array.isArray(data) ? data : [data]
            for (const rec of positions) {
              if (this.onPosition) {
                this.onPosition(mapBybitPosition(rec as BybitPositionRecord))
              }
            }
            break
          }
          case 'wallet': {
            const wallets = Array.isArray(data) ? data : [data]
            const balances: Record<string, BrokerBalance> = {}
            for (const w of wallets) {
              const coin = (w as { coin: string }).coin
              const balance = mapBybitBalance(w as BybitWalletBalance)
              balances[coin] = balance
            }
            if (this.onBalance) {
              this.onBalance(balances)
            }
            break
          }
        }
      }
    } catch {
      // Silently skip unparseable messages
    }
  }

  private mapBybitFill(rec: Record<string, unknown>): BrokerFill {
    return {
      id: String(rec.execId ?? ''),
      orderId: String(rec.orderId ?? ''),
      brokerOrderId: String(rec.orderId ?? ''),
      symbol: String(rec.symbol ?? ''),
      side: String(rec.side ?? '').toLowerCase() as 'buy' | 'sell',
      quantity: parseFloat(String(rec.execQty ?? '0')),
      price: parseFloat(String(rec.execPrice ?? '0')),
      commission: parseFloat(String(rec.execFee ?? '0')),
      commissionAsset: String(rec.feeCurrency ?? '') || undefined,
      timestamp: parseInt(String(rec.execTime ?? '0'), 10),
    }
  }

  private scheduleReconnect(): void {
    if (this.manualDisconnect) return
    if (this.reconnectAttempt >= this.config.maxWsReconnectAttempts) {
      this.onError?.(new NetworkError('Bybit WS max reconnects reached'))
      return
    }

    const delay = this.config.wsReconnectDelayMs * Math.pow(1.5, this.reconnectAttempt)
    const jitter = delay * (0.5 + Math.random() * 0.5)
    this.reconnectAttempt++

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect()
      } catch {
        this.scheduleReconnect()
      }
    }, Math.min(jitter, 30_000))
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 'ping' }))
      }
    }, PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  dispose(): void {
    this.disconnect()
  }
}

// ═══════════════════════════════════════════════
// BybitConnectionAdapter
// ═══════════════════════════════════════════════

class BybitConnectionAdapter implements ConnectionAdapter {
  private state: BybitState

  constructor(state: BybitState) {
    this.state = state
  }

  async connect(apiKey: string, apiSecret: string, testnet = false): Promise<void> {
    if (this.state.connected) return

    const config: Required<BybitConfig> = {
      ...DEFAULTS,
      apiKey,
      apiSecret,
      testnet,
      restBaseUrl: testnet ? REST_TESTNET : REST_MAINNET,
      wsPrivateUrl: testnet ? WS_PRIVATE_TESTNET : WS_PRIVATE_MAINNET,
    }

    this.state.config = config
    this.state.clock = new BrokerClock()

    // Verify connectivity: fetch server time
    try {
      const timeUrl = `${config.restBaseUrl}/v5/market/time`
      const result = await publicRequest<{ timeSecond: string }>('GET', timeUrl, this.state)
      const serverTime = parseInt(result.timeSecond, 10)
      if (!isNaN(serverTime)) {
        this.state.clock.sync(serverTime * 1000) // ms
      }
    } catch {
      // Non-fatal — clock stays local
    }

    // Verify auth: fetch account info
    try {
      await signedRequest<BybitAccountInfo>(this.state, 'GET', '/v5/account/info')
    } catch (err) {
      this.state.connected = false
      throw new AuthenticationError(`Bybit auth failed: ${String(err)}`)
    }

    // Connect private WS
    this.state.privateWs = new BybitPrivateWsClient(config, 'bybit', this.state.wsFactory)
    const ws = this.state.privateWs

    ws.onOrder = (order) => {
      for (const h of this.state.orderHandlers) h(order)
    }
    ws.onFill = (fill) => {
      for (const h of this.state.fillHandlers) h(fill)
    }
    ws.onPosition = (pos) => {
      for (const h of this.state.positionHandlers) h(pos)
    }
    ws.onBalance = (balances) => {
      for (const h of this.state.balanceHandlers) h(balances)
    }
    ws.onError = (err) => {
      console.error('[BybitBrokerAdapter] Private WS error:', err.message)
    }

    try {
      await ws.connect()
    } catch (err) {
      console.warn('[BybitBrokerAdapter] Private WS connect failed (non-fatal):', String(err))
      // Continue without WS — REST fallback works
    }

    this.state.connected = true
  }

  async disconnect(): Promise<void> {
    this.state.privateWs?.disconnect()
    this.state.privateWs = null
    this.state.connected = false
  }

  isConnected(): boolean {
    return this.state.connected
  }

  async getServerTime(): Promise<number> {
    const timeUrl = `${this.state.config.restBaseUrl}/v5/market/time`
    const result = await publicRequest<{ timeSecond: string }>('GET', timeUrl, this.state)
    return parseInt(result.timeSecond, 10) * 1000
  }
}

// ═══════════════════════════════════════════════
// BybitOrderAdapter
// ═══════════════════════════════════════════════

class BybitOrderAdapter implements OrderAdapter {
  private state: BybitState

  constructor(state: BybitState) {
    this.state = state
  }

  async placeOrder(params: BrokerPlacementParams): Promise<BrokerOrder> {
    // ── Pre-trade validation against exchange rules ──
    const symbol = params.symbol
    let info = this.state.symbolInfo?.get(symbol)

    if (!info) {
      // Lazy-load if not cached yet
      try {
        await fetchInstruments(this.state, [symbol])
        info = this.state.symbolInfo?.get(symbol)
      } catch { /* silent — proceed without validation */ }
    }

    if (info) {
      validateOrder(info, params)
    }

    const body: Record<string, string | number | boolean> = {
      category: 'linear',
      symbol: params.symbol,
      side: params.side === 'buy' ? 'Buy' : 'Sell',
      orderType: params.type === 'market' ? 'Market' : 'Limit',
      qty: String(params.quantity),
    }

    if (params.price && params.price > 0) {
      body.price = String(params.price)
    }

    if (params.timeInForce) {
      body.timeInForce = params.timeInForce
    }

    if (params.reduceOnly) {
      body.reduceOnly = true
      // In one-way mode, positionIdx=0 means auto-detect
      body.positionIdx = 0
    }

    if (params.postOnly) {
      body.timeInForce = 'PostOnly'
    }

    // ── Generate idempotency key (orderLinkId) ──
    // Bybit uses orderLinkId for dedup: same orderLinkId + same create request = safe retry
    const orderLinkId = params.clientOrderId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    body.orderLinkId = orderLinkId

    // ── Send order with idempotent retry ──
    let lastError: Error | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await signedRequest<BybitOrderResult>(
          this.state,
          'POST',
          '/v5/order/create',
          body as unknown as Record<string, string | number | boolean | undefined>,
        )

        // Fetch the full order to return complete state
        return this.getOrder(result.orderId, params.symbol) ?? (() => { throw new Error(`Order ${result.orderId} not found after placement`) })()
      } catch (err) {
        lastError = err as Error

        // Only retry on network errors (timeout, connection lost)
        // Exchange rejections (10003, 10001 etc.) are NOT retried
        if (err instanceof NetworkError && attempt === 0) {
          // Network error — order MAY have been created on exchange
          // Query by orderLinkId to check
          try {
            const existing = await this.getOrderByLinkId(orderLinkId, params.symbol)
            if (existing) {
              // Order was created — return it (idempotent recovery)
              return existing
            }
            // Not found — retry placement
            continue
          } catch {
            // Query also failed — retry placement
            continue
          }
        }

        // Non-network error or retries exhausted — throw
        throw err
      }
    }

    throw lastError ?? new Error('placeOrder failed after retries')
  }

  /**
   * Query an order by orderLinkId (client order ID).
   * Returns the order if found, or undefined if not.
   */
  private async getOrderByLinkId(
    orderLinkId: string,
    symbol: string,
  ): Promise<BrokerOrder | undefined> {
    try {
      const result = await signedRequest<{ list?: BybitOrderRecord[] }>(
        this.state,
        'GET',
        `/v5/order/realtime?category=linear&symbol=${symbol}&orderLinkId=${orderLinkId}`,
      )
      if (result.list && result.list.length > 0) {
        return mapBybitOrder(result.list[0], 'bybit')
      }
      return undefined
    } catch {
      return undefined
    }
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<boolean> {
    const body: Record<string, string | number | boolean> = {
      category: 'linear',
      orderId,
    }
    if (symbol) body.symbol = symbol

    try {
      await signedRequest<BybitOrderResult>(
        this.state,
        'POST',
        '/v5/order/cancel',
        body as unknown as Record<string, string | number | boolean | undefined>,
      )
      return true
    } catch (err) {
      // Order already cancelled
      if (err instanceof ValidationError) return true
      throw err
    }
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    const openOrders = await this.getOpenOrders(symbol)
    let count = 0
    for (const order of openOrders) {
      try {
        await this.cancelOrder(order.brokerOrderId, order.symbol)
        count++
      } catch {
        // Skip failed cancellations
      }
    }
    return count
  }

  async amendOrder(
    orderId: string,
    params: Partial<BrokerPlacementParams>,
  ): Promise<BrokerOrder> {
    const body: Record<string, string | number | boolean> = {
      category: 'linear',
      orderId,
    }

    if (params.price !== undefined) {
      body.price = String(params.price)
    }
    if (params.quantity !== undefined) {
      body.qty = String(params.quantity)
    }

    const result = await signedRequest<BybitOrderResult>(
      this.state,
      'POST',
      '/v5/order/amend',
      body as unknown as Record<string, string | number | boolean | undefined>,
    )

    return this.getOrder(result.orderId, params.symbol ?? '') ?? (() => { throw new Error(`Amend order ${result.orderId} not found`) })()
  }

  async replaceOrder(
    orderId: string,
    params: Partial<BrokerPlacementParams>,
  ): Promise<BrokerOrder> {
    // Cancel + place new (atomic amend preferred)
    return this.amendOrder(orderId, params)
  }

  async getOrder(orderId: string, symbol?: string): Promise<BrokerOrder | null> {
    const params: Record<string, string | number | boolean | undefined> = {
      category: 'linear',
      orderId,
    }
    if (symbol) {
      params.symbol = symbol
    } else {
      params.settleCoin = 'USDT'
    }

    try {
      const result = await signedRequest<{ list: BybitOrderRecord[] }>(
        this.state,
        'GET',
        '/v5/order/realtime',
        params,
      )
      const list = result.list ?? []
      return list.length > 0 ? mapBybitOrder(list[0], 'bybit') : null
    } catch (err) {
      if (err instanceof ValidationError) return null
      throw err
    }
  }

  async getOpenOrders(symbol?: string): Promise<BrokerOrder[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      category: 'linear',
      openOnly: 1,
    }
    if (symbol) {
      params.symbol = symbol
    } else {
      // When no symbol specified, use settleCoin to enumerate all linear open orders
      params.settleCoin = 'USDT'
    }

    const result = await signedRequest<{ list: BybitOrderRecord[] }>(
      this.state,
      'GET',
      '/v5/order/realtime',
      params,
    )
    return (result.list ?? []).map((r) => mapBybitOrder(r, 'bybit'))
  }

  async getOrderHistory(symbol: string, limit = 20): Promise<BrokerOrder[]> {
    const result = await signedRequest<{ list: BybitOrderRecord[] }>(
      this.state,
      'GET',
      '/v5/order/history',
      {
        category: 'linear',
        symbol,
        limit,
      },
    )
    return (result.list ?? []).map((r) => mapBybitOrder(r, 'bybit'))
  }

  subscribeOrders(handler: (order: BrokerOrder) => void): () => void {
    this.state.orderHandlers.push(handler)
    return () => {
      this.state.orderHandlers = this.state.orderHandlers.filter((h) => h !== handler)
    }
  }

  subscribeFills(handler: (fill: BrokerFill) => void): () => void {
    this.state.fillHandlers.push(handler)
    return () => {
      this.state.fillHandlers = this.state.fillHandlers.filter((h) => h !== handler)
    }
  }
}

// ═══════════════════════════════════════════════
// BybitPositionAdapter
// ═══════════════════════════════════════════════

class BybitPositionAdapter implements PositionAdapter {
  private state: BybitState

  constructor(state: BybitState) {
    this.state = state
  }

  async getPositions(symbol?: string): Promise<BrokerPosition[]> {
    const params: Record<string, string | number | boolean | undefined> = {
      category: 'linear',
    }
    if (symbol) {
      params.symbol = symbol
    } else {
      params.settleCoin = 'USDT'
    }

    const result = await signedRequest<{ list: BybitPositionRecord[] }>(
      this.state,
      'GET',
      '/v5/position/list',
      params,
    )
    return (result.list ?? []).map(mapBybitPosition)
  }

  async getPosition(symbol: string): Promise<BrokerPosition | null> {
    const positions = await this.getPositions(symbol)
    // For linear USDT perpetual, there's one position per symbol
    return positions.find((p) => p.quantity > 0) ?? null
  }

  subscribePositions(handler: (pos: BrokerPosition) => void): () => void {
    this.state.positionHandlers.push(handler)
    return () => {
      this.state.positionHandlers = this.state.positionHandlers.filter((h) => h !== handler)
    }
  }
}

// ═══════════════════════════════════════════════
// BybitAccountAdapter
// ═══════════════════════════════════════════════

class BybitAccountAdapter implements AccountAdapter {
  private state: BybitState

  constructor(state: BybitState) {
    this.state = state
  }

  async getBalances(): Promise<Record<string, BrokerBalance>> {
    const accountType = this.state.config.testnet ? 'UNIFIED' : 'UNIFIED'
    const result = await signedRequest<{ list: { coin: BybitWalletBalance[] }[] }>(
      this.state,
      'GET',
      '/v5/account/wallet-balance',
      { accountType, coin: 'USDT' },
    )
    const balances: Record<string, BrokerBalance> = {}
    for (const acct of result.list ?? []) {
      for (const coin of acct.coin ?? []) {
        balances[coin.coin] = mapBybitBalance(coin)
      }
    }
    return balances
  }

  async getAccountInfo(): Promise<BrokerAccountInfo> {
    const result = await signedRequest<BybitAccountInfo>(
      this.state,
      'GET',
      '/v5/account/info',
    )
    return {
      // Bybit uses unified account by default
      canTrade: true,
      canWithdraw: result.unifyStatus === 1,
      canDeposit: result.unifyStatus === 1,
      accountType: result.unifyStatus === 1 ? 'unified' : 'classic',
      marginMode: result.marginMode === 'REGULAR_MARGIN' ? 'cross' : 'isolated',
    }
  }

  subscribeBalances(handler: (balances: Record<string, BrokerBalance>) => void): () => void {
    this.state.balanceHandlers.push(handler)
    return () => {
      this.state.balanceHandlers = this.state.balanceHandlers.filter((h) => h !== handler)
    }
  }
}

// ═══════════════════════════════════════════════
// Main BybitBrokerAdapter
// ═══════════════════════════════════════════════

export class BybitBrokerAdapter implements BrokerAdapter {
  readonly id = 'bybit'
  readonly name = 'Bybit (Linear Perpetual)'
  readonly capabilities: BrokerCapabilities = BYBIT_CAPABILITIES

  readonly connection: ConnectionAdapter
  readonly orders: OrderAdapter
  readonly positions: PositionAdapter
  readonly account: AccountAdapter

  private state: BybitState

  // Market data — reuse existing BybitFeedAdapter instead

  constructor(
    fetchFn?: typeof globalThis.fetch,
    wsFactory?: IWebSocketFactory,
  ) {
    this.state = this.createInitialState(fetchFn, wsFactory)
    this.connection = new BybitConnectionAdapter(this.state)
    this.orders = new BybitOrderAdapter(this.state)
    this.positions = new BybitPositionAdapter(this.state)
    this.account = new BybitAccountAdapter(this.state)
  }

  private createInitialState(
    fetchFn?: typeof globalThis.fetch,
    wsFactory?: IWebSocketFactory,
  ): BybitState {
    return {
      connected: false,
      config: { ...DEFAULTS, apiKey: '', apiSecret: '' },
      clock: new BrokerClock(),
      fetchFn: fetchFn ?? fetch,
      wsFactory: wsFactory ?? new NativeWebSocketFactory(),
      lastServerTimeSync: 0,
      privateWs: null,
      orderHandlers: [],
      fillHandlers: [],
      positionHandlers: [],
      balanceHandlers: [],
      symbolInfo: null,
    }
  }

  async dispose(): Promise<void> {
    await this.connection.disconnect()
    this.state = this.createInitialState()
  }
}
