// ── Trade Domain: Order model ──

import {
  BrokerOrderStatus,
  ORDER_TRANSITIONS,
  OrderSide,
  OrderType,
  TimeInForce,
  type Fill,
} from './types'

/** Order identifier: client-generated for idempotency */
export type OrderId = string

export interface OrderProps {
  id: OrderId
  tradeId?: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  timeInForce?: TimeInForce
  reduceOnly?: boolean
  postOnly?: boolean
  clientOrderId?: string
  brokerOrderId?: string
  status: BrokerOrderStatus
  fills: Fill[]
  rejectReason?: string
  expireTime?: number
  createdAt: number
  updatedAt: number
  /** Runtime-only: last error from gateway/retry */
  lastError?: string
  /** Runtime-only: retry counters */
  retryCount?: number
  maxRetries?: number
}

/**
 * Order — domain model with FSM validation.
 *
 * Every status transition goes through `transitionTo()` which validates against
 * the FSM table. Non-FSM runtime fields (filledQuantity, averagePrice) are
 * managed by OrderManager via placeholders — Order computes them from fills.
 *
 * FSM (from types.ts):
 * ```
 * New → Submitted → Accepted → Working → PartialFill → Filled
 *                    ↘             ↙        ↙
 *                   Cancelled ← Rejected ← Expired
 * ```
 */
export class Order {
  readonly id: OrderId
  readonly tradeId?: string
  readonly symbol: string
  readonly side: OrderSide
  readonly type: OrderType
  readonly quantity: number
  readonly price?: number
  readonly stopPrice?: number
  readonly timeInForce?: TimeInForce
  readonly reduceOnly: boolean
  readonly postOnly: boolean
  readonly clientOrderId?: string
  readonly expireTime?: number
  readonly createdAt: number

  private _brokerOrderId?: string
  private _status: BrokerOrderStatus
  private _fills: Fill[]
  private _updatedAt: number
  private _lastError?: string
  private _retryCount: number
  private _maxRetries: number

  constructor(props: OrderProps) {
    this.id = props.id
    this.tradeId = props.tradeId
    this.symbol = props.symbol
    this.side = props.side
    this.type = props.type
    this.quantity = props.quantity
    this.price = props.price
    this.stopPrice = props.stopPrice
    this.timeInForce = props.timeInForce
    this.reduceOnly = props.reduceOnly ?? false
    this.postOnly = props.postOnly ?? false
    this.clientOrderId = props.clientOrderId
    this._brokerOrderId = props.brokerOrderId
    this._status = props.status
    this._fills = [...(props.fills ?? [])]
    this.rejectReason = props.rejectReason
    this.expireTime = props.expireTime
    this.createdAt = props.createdAt
    this._updatedAt = props.updatedAt
    this._lastError = props.lastError
    this._retryCount = props.retryCount ?? 0
    this._maxRetries = props.maxRetries ?? 0
  }

  // ── Accessors ──

  get brokerOrderId(): string | undefined {
    return this._brokerOrderId
  }

  get status(): BrokerOrderStatus {
    return this._status
  }

  get fills(): readonly Fill[] {
    return Object.freeze([...this._fills])
  }

  get updatedAt(): number {
    return this._updatedAt
  }

  get lastError(): string | undefined {
    return this._lastError
  }

  get retryCount(): number {
    return this._retryCount
  }

  get maxRetries(): number {
    return this._maxRetries
  }

  /** Total filled quantity */
  get filledQuantity(): number {
    return this._fills.reduce((sum, f) => sum + f.quantity, 0)
  }

  /** Remaining unfilled quantity */
  get remainingQuantity(): number {
    return Math.max(0, this.quantity - this.filledQuantity)
  }

  /** Average fill price (VWAP) */
  get averagePrice(): number | undefined {
    if (this._fills.length === 0) return undefined
    const totalQuote = this._fills.reduce((sum, f) => sum + f.price * f.quantity, 0)
    const totalQty = this.filledQuantity
    return totalQty > 0 ? totalQuote / totalQty : undefined
  }

  get isTerminal(): boolean {
    return this._status === BrokerOrderStatus.Filled
      || this._status === BrokerOrderStatus.Cancelled
      || this._status === BrokerOrderStatus.Rejected
      || this._status === BrokerOrderStatus.Expired
  }

  get isActive(): boolean {
    return !this.isTerminal
  }

  // ── Setters for OrderManager runtime ──

  set brokerOrderId(id: string | undefined) {
    this._brokerOrderId = id
    this._updatedAt = Date.now()
  }

  set lastError(err: string | undefined) {
    this._lastError = err
    this._updatedAt = Date.now()
  }

  set retryCount(n: number) {
    this._retryCount = n
  }

  set maxRetries(n: number) {
    this._maxRetries = n
  }

  /** Touch updatedAt (called by OrderManager after external mutations) */
  touch(): void {
    this._updatedAt = Date.now()
  }

  // ── FSM transition ──

  /**
   * Attempt a valid FSM transition.
   * @returns the new status on success
   * @throws {Error} if the transition is not allowed
   */
  transitionTo(next: BrokerOrderStatus): BrokerOrderStatus {
    const allowed = ORDER_TRANSITIONS[this._status]
    if (!allowed.includes(next)) {
      throw new Error(
        `Order FSM: invalid transition ${this._status} → ${next}. ` +
        `Allowed from ${this._status}: [${allowed.join(', ')}]`
      )
    }
    this._status = next
    this._updatedAt = Date.now()
    return next
  }

  /**
   * Attach a fill to this order. Updates status to PartialFill (or Filled if complete).
   * @returns the new status
   */
  addFill(fill: Fill): BrokerOrderStatus {
    this._fills.push(fill)
    const filled = this.filledQuantity
    if (filled >= this.quantity) {
      return this.transitionTo(BrokerOrderStatus.Filled)
    }
    if (this._status !== BrokerOrderStatus.PartialFill) {
      return this.transitionTo(BrokerOrderStatus.PartialFill)
    }
    this._updatedAt = Date.now()
    return this._status
  }

  /** Snapshot for persistence */
  toSnapshot(): OrderProps {
    return {
      id: this.id,
      tradeId: this.tradeId,
      symbol: this.symbol,
      side: this.side,
      type: this.type,
      quantity: this.quantity,
      price: this.price,
      stopPrice: this.stopPrice,
      timeInForce: this.timeInForce,
      reduceOnly: this.reduceOnly,
      postOnly: this.postOnly,
      clientOrderId: this.clientOrderId,
      brokerOrderId: this._brokerOrderId,
      status: this._status,
      fills: [...this._fills],
      rejectReason: this.rejectReason,
      expireTime: this.expireTime,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      lastError: this._lastError,
      retryCount: this._retryCount,
      maxRetries: this._maxRetries,
    }
  }

  /** Restore from snapshot */
  static fromSnapshot(props: OrderProps): Order {
    return new Order(props)
  }
}
