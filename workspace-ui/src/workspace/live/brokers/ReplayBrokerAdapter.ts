/**
 * ReplayBrokerAdapter.ts — Recorded event replay for deterministic testing
 *
 * Replays pre-recorded broker events (orders, fills, positions, balances)
 * to drive LiveProvider deterministically without connecting to an exchange.
 *
 * Perfect for:
 *   - Reproducing real trading sessions in tests
 *   - Stress-testing LiveProvider from recorded data
 *   - Validating state machine transitions
 *
 * @since 4.6
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
} from '../live/types'
import { MOCK_CAPABILITIES } from '../live/BrokerCapabilities'
import { BrokerError } from '../live/BrokerError'

// ── Event Types for Recorded Sessions ──

export type ReplayEvent =
  | { type: 'order'; data: BrokerOrder; timestamp: number }
  | { type: 'fill'; data: BrokerFill; timestamp: number }
  | { type: 'position'; data: BrokerPosition; timestamp: number }
  | { type: 'balance'; data: Record<string, BrokerBalance>; timestamp: number }
  | { type: 'account'; data: BrokerAccountInfo; timestamp: number }
  | { type: 'error'; message: string; timestamp: number }
  | { type: 'disconnect'; timestamp: number }

export interface ReplaySession {
  name: string
  events: ReplayEvent[]
  description?: string
}

// ── Adapter ──

export interface ReplayBrokerConfig {
  /** Use wall clock time instead of event timestamps */
  realtime?: boolean
  /** Speed multiplier (2 = 2x speed, 0.5 = half speed) */
  speed?: number
}

interface ReplayBrokerState {
  playing: boolean
  eventIndex: number
  orderHandlers: Array<(order: BrokerOrder) => void>
  fillHandlers: Array<(fill: BrokerFill) => void>
  positionHandlers: Array<(pos: BrokerPosition) => void>
  balanceHandlers: Array<(balances: Record<string, BrokerBalance>) => void>
}

export class ReplayBrokerAdapter implements BrokerAdapter {
  readonly id: string
  readonly name: string
  readonly capabilities: BrokerCapabilities = MOCK_CAPABILITIES

  readonly connection: ConnectionAdapter
  readonly orders: OrderAdapter
  readonly positions: PositionAdapter
  readonly account: AccountAdapter

  readonly state: ReplayBrokerState

  private session: ReplaySession
  private config: Required<ReplayBrokerConfig>
  private playbackTimer: ReturnType<typeof setTimeout> | null = null

  constructor(session: ReplaySession, config: ReplayBrokerConfig = {}) {
    this.session = session
    this.id = `replay-${session.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    this.name = `Replay: ${session.name}`
    this.config = {
      realtime: true,
      speed: 1,
      ...config,
    }

    this.state = {
      playing: false,
      eventIndex: 0,
      orderHandlers: [],
      fillHandlers: [],
      positionHandlers: [],
      balanceHandlers: [],
    }

    this.connection = new ReplayConnectionAdapter(this)
    this.orders = new ReplayOrderAdapter(this)
    this.positions = new ReplayPositionAdapter(this)
    this.account = new ReplayAccountAdapter(this)
  }

  /** Start playback of the recorded session */
  startPlayback(): void {
    if (this.state.playing) return
    this.state.playing = true
    this.state.eventIndex = 0
    this.scheduleNext()
  }

  /** Pause playback */
  pausePlayback(): void {
    this.state.playing = false
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer)
      this.playbackTimer = null
    }
  }

  /** Stop and reset playback */
  stopPlayback(): void {
    this.pausePlayback()
    this.state.eventIndex = 0
  }

  get progress(): number {
    return this.session.events.length > 0
      ? this.state.eventIndex / this.session.events.length
      : 0
  }

  dispose(): Promise<void> {
    this.stopPlayback()
    this.state.orderHandlers = []
    this.state.fillHandlers = []
    this.state.positionHandlers = []
    this.state.balanceHandlers = []
    return Promise.resolve()
  }

  private scheduleNext(): void {
    if (!this.state.playing || this.state.eventIndex >= this.session.events.length) {
      this.state.playing = false
      return
    }

    const event = this.session.events[this.state.eventIndex]

    if (this.config.realtime && this.state.eventIndex > 0) {
      const prevEvent = this.session.events[this.state.eventIndex - 1]
      const elapsed = event.timestamp - prevEvent.timestamp
      const delay = Math.max(0, elapsed / this.config.speed)

      this.playbackTimer = setTimeout(() => {
        this.dispatchEvent(event)
        this.state.eventIndex++
        this.scheduleNext()
      }, delay)
    } else {
      // Immediate — dispatch all remaining events
      while (this.state.eventIndex < this.session.events.length) {
        this.dispatchEvent(this.session.events[this.state.eventIndex])
        this.state.eventIndex++
      }
      this.state.playing = false
    }
  }

  private dispatchEvent(event: ReplayEvent): void {
    switch (event.type) {
      case 'order':
        for (const h of this.state.orderHandlers) h(event.data)
        break
      case 'fill':
        for (const h of this.state.fillHandlers) h(event.data)
        break
      case 'position':
        for (const h of this.state.positionHandlers) h(event.data)
        break
      case 'balance':
        for (const h of this.state.balanceHandlers) h(event.data)
        break
      case 'disconnect':
        break
    }
  }

  /** Register a handler on the internal event bus for legacy BrokerEventAdapter */
  on(event: string, handler: (event: any) => void): () => void {
    switch (event) {
      case 'order':
        this.state.orderHandlers.push(handler)
        return () => {
          this.state.orderHandlers = this.state.orderHandlers.filter((h) => h !== handler)
        }
      case 'fill':
        this.state.fillHandlers.push(handler)
        return () => {
          this.state.fillHandlers = this.state.fillHandlers.filter((h) => h !== handler)
        }
      case 'position':
        this.state.positionHandlers.push(handler)
        return () => {
          this.state.positionHandlers = this.state.positionHandlers.filter((h) => h !== handler)
        }
      default:
        return () => {}
    }
  }

  off(_event: string, _handler: (event: any) => void): void {
    // No-op — individual unsubscribe handles cleanup
  }
}

// ── Sub-adapter Implementations ──

class ReplayConnectionAdapter implements ConnectionAdapter {
  private owner: ReplayBrokerAdapter

  constructor(owner: ReplayBrokerAdapter) {
    this.owner = owner
  }

  async connect(): Promise<void> {
    this.owner.state.playing = true
    this.owner.startPlayback()
  }

  async disconnect(): Promise<void> {
    this.owner.state.playing = false
    this.owner.stopPlayback()
  }

  isConnected(): boolean {
    return this.owner.state.playing
  }
}

class ReplayOrderAdapter implements OrderAdapter {
  private owner: ReplayBrokerAdapter
  private state = new Map<string, BrokerOrder>()

  constructor(owner: ReplayBrokerAdapter) {
    this.owner = owner
  }

  subscribeOrders(handler: (order: BrokerOrder) => void): () => void {
    this.owner.state.orderHandlers.push((order) => {
      this.state.set(order.brokerOrderId, order)
      handler(order)
    })
    return () => {
      this.owner.state.orderHandlers = this.owner.state.orderHandlers.filter((h) => h !== handler)
    }
  }

  subscribeFills(handler: (fill: BrokerFill) => void): () => void {
    this.owner.state.fillHandlers.push(handler)
    return () => {
      this.owner.state.fillHandlers = this.owner.state.fillHandlers.filter((h) => h !== handler)
    }
  }

  async placeOrder(): Promise<BrokerOrder> {
    const msg = `ReplayBrokerAdapter: cannot place orders during replay`
    throw new BrokerError(msg, 'REPLAY_READONLY')
  }

  async cancelOrder(): Promise<boolean> {
    const msg = 'ReplayBrokerAdapter: cannot cancel orders during replay'
    throw new BrokerError(msg, 'REPLAY_READONLY')
  }

  async cancelAllOrders(): Promise<number> {
    return 0
  }

  async replaceOrder(): Promise<BrokerOrder> {
    const msg = 'ReplayBrokerAdapter: cannot modify orders during replay'
    throw new BrokerError(msg, 'REPLAY_READONLY')
  }

  async getOrder(orderId: string): Promise<BrokerOrder | null> {
    return this.state.get(orderId) ?? null
  }

  async getOpenOrders(): Promise<BrokerOrder[]> {
    return Array.from(this.state.values()).filter(
      (o) => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED'
    )
  }

  async getOrderHistory(): Promise<BrokerOrder[]> {
    return Array.from(this.state.values())
  }
}

class ReplayPositionAdapter implements PositionAdapter {
  private owner: ReplayBrokerAdapter
  private lastPositions = new Map<string, BrokerPosition>()

  constructor(owner: ReplayBrokerAdapter) {
    this.owner = owner
  }

  subscribePositions(handler: (pos: BrokerPosition) => void): () => void {
    this.owner.state.positionHandlers.push((pos) => {
      this.lastPositions.set(pos.symbol, pos)
      handler(pos)
    })
    return () => {
      this.owner.state.positionHandlers = this.owner.state.positionHandlers.filter((h) => h !== handler)
    }
  }

  async getPositions(): Promise<BrokerPosition[]> {
    return Array.from(this.lastPositions.values())
  }

  async getPosition(symbol: string): Promise<BrokerPosition | null> {
    return this.lastPositions.get(symbol) ?? null
  }
}

class ReplayAccountAdapter implements AccountAdapter {
  private owner: ReplayBrokerAdapter
  private lastBalances: Record<string, BrokerBalance> = {}
  private lastAccountInfo: BrokerAccountInfo = {
    balances: {},
    totalEquity: 0,
    unrealizedPnl: 0,
    canTrade: true,
  }

  constructor(owner: ReplayBrokerAdapter) {
    this.owner = owner

    this.owner.state.balanceHandlers.push((bals) => {
      this.lastBalances = bals
    })
  }

  subscribeBalances(handler: (balances: Record<string, BrokerBalance>) => void): () => void {
    this.owner.state.balanceHandlers.push(handler)
    return () => {
      this.owner.state.balanceHandlers = this.owner.state.balanceHandlers.filter((h) => h !== handler)
    }
  }

  async getBalances(): Promise<Record<string, BrokerBalance>> {
    return this.lastBalances
  }

  async getAccountInfo(): Promise<BrokerAccountInfo> {
    return {
      ...this.lastAccountInfo,
      balances: this.lastBalances,
      totalEquity: Object.values(this.lastBalances).reduce((s, b) => s + b.total, 0),
    }
  }
}
