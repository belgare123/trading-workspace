// ── Trade Domain: Trade model ──

import { randomUUID } from 'crypto'
import {
  TradeStatus,
  TRADE_TRANSITIONS,
  Direction,
  type EntryRecord,
  type ExitRecord,
  type ExitReason,
  type TradeTimestamps,
  type Fee,
  type Fill,
} from './types'
import { Order, type OrderId } from './Order'

/** Trade identifier */
export type TradeId = string

export interface TradeProps {
  id: TradeId
  strategyId: string
  symbol: string
  direction: Direction
  status: TradeStatus
  entry: EntryRecord | null
  exits: ExitRecord[]
  orderIds: OrderId[]
  fees: Fee[]
  realizedPnL: number
  unrealizedPnL: number
  metadata: Record<string, unknown>
  timestamps: TradeTimestamps
  signalId?: string
  signalName?: string
}

/**
 * Trade — root domain aggregate with FSM validation.
 *
 * Every status transition goes through `transitionTo()` which validates against
 * the FSM table. Direct mutation of `status` is not allowed.
 *
 * FSM (from types.ts):
 * ```
 * Created → EntryPending → EntryPartial → EntryFilled → Managing → ExitPending → ExitPartial → Closed
 *    ↓          ↙              ↙                                                   ↙
 * Rejected ← Cancelled                                                    Cancelled
 * ```
 */
export class Trade {
  readonly id: TradeId
  readonly strategyId: string
  readonly symbol: string
  readonly direction: Direction
  private _status: TradeStatus
  private _entry: EntryRecord | null
  private _exits: ExitRecord[]
  readonly orderIds: OrderId[]
  private _fees: Fee[]
  private _realizedPnL: number
  private _unrealizedPnL: number
  readonly metadata: Record<string, unknown>
  readonly timestamps: TradeTimestamps
  readonly signalId?: string
  readonly signalName?: string

  constructor(props: TradeProps) {
    this.id = props.id
    this.strategyId = props.strategyId
    this.symbol = props.symbol
    this.direction = props.direction
    this._status = props.status
    this._entry = props.entry ?? null
    this._exits = [...(props.exits ?? [])]
    this.orderIds = [...(props.orderIds ?? [])]
    this._fees = [...(props.fees ?? [])]
    this._realizedPnL = props.realizedPnL ?? 0
    this._unrealizedPnL = props.unrealizedPnL ?? 0
    this.metadata = { ...(props.metadata ?? {}) }
    this.timestamps = { ...props.timestamps }
    this.signalId = props.signalId
    this.signalName = props.signalName
  }

  /** Create a new Trade in `Created` status */
  static create(params: {
    strategyId: string
    symbol: string
    direction: Direction
    signalId?: string
    signalName?: string
    metadata?: Record<string, unknown>
  }): Trade {
    const now = Date.now()
    return new Trade({
      id: randomUUID(),
      strategyId: params.strategyId,
      symbol: params.symbol,
      direction: params.direction,
      status: TradeStatus.Created,
      entry: null,
      exits: [],
      orderIds: [],
      fees: [],
      realizedPnL: 0,
      unrealizedPnL: 0,
      metadata: params.metadata ?? {},
      timestamps: { created: now, updated: now },
      signalId: params.signalId,
      signalName: params.signalName,
    })
  }

  // ── Accessors ──

  get status(): TradeStatus {
    return this._status
  }

  get entry(): EntryRecord | null {
    return this._entry
  }

  get exits(): readonly ExitRecord[] {
    return Object.freeze([...this._exits])
  }

  get fees(): readonly Fee[] {
    return Object.freeze([...this._fees])
  }

  get realizedPnL(): number {
    return this._realizedPnL
  }

  get unrealizedPnL(): number {
    return this._unrealizedPnL
  }

  /** Total entry quantity */
  get entryQuantity(): number {
    return this._entry?.quantity ?? 0
  }

  /** Total exited quantity */
  get exitedQuantity(): number {
    return this._exits.reduce((sum, e) => sum + e.quantity, 0)
  }

  /** Remaining open quantity */
  get openQuantity(): number {
    return this.entryQuantity - this.exitedQuantity
  }

  get isFullyClosed(): boolean {
    return this.openQuantity <= 0
  }

  get isTerminal(): boolean {
    return this._status === TradeStatus.Closed
      || this._status === TradeStatus.Cancelled
      || this._status === TradeStatus.Rejected
      || this._status === TradeStatus.Errored
  }

  get isActive(): boolean {
    return !this.isTerminal
  }

  // ── FSM transition ──

  /**
   * Attempt a valid FSM transition.
   * @returns the new status on success
   * @throws {Error} if the transition is not allowed
   */
  transitionTo(next: TradeStatus): TradeStatus {
    const allowed = TRADE_TRANSITIONS[this._status]
    if (!allowed.includes(next)) {
      throw new Error(
        `Trade FSM: invalid transition ${this._status} → ${next}. ` +
        `Allowed from ${this._status}: [${allowed.join(', ')}]`
      )
    }
    this._status = next
    this.timestamps.updated = Date.now()
    return next
  }

  // ── Lifecycle helpers ──

  /** Record entry sent (EntryPending) */
  setEntryPending(orderId: OrderId): void {
    this.orderIds.push(orderId)
    this.transitionTo(TradeStatus.EntryPending)
    this.timestamps.entrySent = Date.now()
  }

  /** Record entry fill (EntryPartial) */
  addEntryFill(fill: Fill): void {
    const existingEntry = this._entry

    if (!existingEntry) {
      // First fill
      this._entry = {
        price: fill.price,
        quantity: fill.quantity,
        quoteQuantity: fill.quoteQuantity,
        timestamp: fill.timestamp,
        orderId: fill.orderId,
      }
      this.timestamps.entryFilled = Date.now()
      this.transitionTo(TradeStatus.EntryPartial)
    } else {
      // Additional fill — update VWAP
      const totalQty = existingEntry.quantity + fill.quantity
      const totalQuote = existingEntry.quoteQuantity + fill.quoteQuantity
      this._entry = {
        ...existingEntry,
        price: totalQuote / totalQty,
        quantity: totalQty,
        quoteQuantity: totalQuote,
        timestamp: fill.timestamp,
      }
      this.timestamps.entryFilled = Date.now()
      // Stay in EntryPartial until completeEntry() is called
      if (this._status !== TradeStatus.EntryPartial) {
        this.transitionTo(TradeStatus.EntryPartial)
      }
    }

    this.addFee(fill.fee)
  }

  /** Complete entry fill (EntryPartial → EntryFilled) */
  completeEntry(): void {
    if (this._status !== TradeStatus.EntryPartial) {
      throw new Error(
        `Trade FSM: cannot completeEntry from ${this._status}, need EntryPartial`
      )
    }
    this.transitionTo(TradeStatus.EntryFilled)
  }

  /** Move to Managing (position fully filled) */
  setManaging(): void {
    if (this._status !== TradeStatus.EntryFilled && this._status !== TradeStatus.EntryPartial) {
      throw new Error(`Trade FSM: cannot setManaging from ${this._status}, need EntryFilled or EntryPartial`)
    }
    this.transitionTo(TradeStatus.Managing)
    this.timestamps.managing = Date.now()
  }

  /** Record exit sent (ExitPending) */
  setExitPending(orderId: OrderId, reason: ExitReason): void {
    this.orderIds.push(orderId)
    this.transitionTo(TradeStatus.ExitPending)
    this.timestamps.exitSent = Date.now()
  }

  /** Record exit fill (Closed, ExitPartial, or Managing for partial) */
  addExitFill(fill: Fill, reason: ExitReason, pnl?: number, pnlPct?: number): void {
    const exitRecord: ExitRecord = {
      price: fill.price,
      quantity: fill.quantity,
      quoteQuantity: fill.quoteQuantity,
      timestamp: fill.timestamp,
      orderId: fill.orderId,
      reason,
      pnl,
      pnlPct,
    }
    this._exits.push(exitRecord)
    this.timestamps.exitFilled = Date.now()
    this.addFee(fill.fee)

    if (pnl !== undefined) {
      this._realizedPnL += pnl
    }

    if (this.isFullyClosed) {
      this.transitionTo(TradeStatus.Closed)
      this.timestamps.closed = Date.now()
    } else {
      this.transitionTo(TradeStatus.ExitPartial)
    }
  }

  /** Cancel the trade (non-terminal → Cancelled) */
  cancel(): void {
    this.transitionTo(TradeStatus.Cancelled)
    this.timestamps.closed = Date.now()
  }

  /** Reject the trade (Created → Rejected) */
  reject(reason?: string): void {
    if (reason) {
      this.metadata.rejectReason = reason
    }
    this.transitionTo(TradeStatus.Rejected)
    this.timestamps.closed = Date.now()
  }

  /** Mark as errored */
  markErrored(error?: string): void {
    if (error) {
      this.metadata.lastError = error
    }
    try {
      this.transitionTo(TradeStatus.Errored)
    } catch {
      // If transition to errored from current state isn't valid, force it
      this._status = TradeStatus.Errored
      this.timestamps.updated = Date.now()
    }
  }

  /** Add a fee record */
  addFee(fee: Fee): void {
    this._fees.push(fee)
  }

  /** Update unrealized PnL */
  updateUnrealizedPnL(pnl: number): void {
    this._unrealizedPnL = pnl
    this.timestamps.updated = Date.now()
  }

  // ── Persistence ──

  /** Snapshot for persistence */
  toSnapshot(): TradeProps {
    return {
      id: this.id,
      strategyId: this.strategyId,
      symbol: this.symbol,
      direction: this.direction,
      status: this._status,
      entry: this._entry ? { ...this._entry } : null,
      exits: this._exits.map(e => ({ ...e })),
      orderIds: [...this.orderIds],
      fees: this._fees.map(f => ({ ...f })),
      realizedPnL: this._realizedPnL,
      unrealizedPnL: this._unrealizedPnL,
      metadata: { ...this.metadata },
      timestamps: { ...this.timestamps },
      signalId: this.signalId,
      signalName: this.signalName,
    }
  }

  /** Restore from snapshot */
  static fromSnapshot(props: TradeProps): Trade {
    return new Trade(props)
  }
}
