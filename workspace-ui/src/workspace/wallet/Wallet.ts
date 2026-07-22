// ── Wallet: domain model ──
// Sprint 5.6 — WalletManager

import type { Balance, WalletSnapshot, WalletEvent, WalletEventType, WalletEventHandler } from './types'
import type { Trade } from '../trade/Trade'

/**
 * Wallet — single source of truth for account balance.
 * Manages cash, equity, locked funds, and PnL tracking.
 */
export class Wallet {
  private _balance: Balance
  /** orderId → reserved amount */
  private readonly _reservations = new Map<string, number>()
  private _openPositionCount = 0
  private readonly _handlers = new Map<string, Set<WalletEventHandler>>()

  constructor(initial?: Partial<Balance>) {
    this._balance = {
      total: initial?.total ?? 0,
      free: initial?.free ?? 0,
      locked: initial?.locked ?? 0,
      marginUsed: initial?.marginUsed ?? 0,
      unrealizedPnL: initial?.unrealizedPnL ?? 0,
      realizedPnL: initial?.realizedPnL ?? 0,
      currency: initial?.currency ?? 'USDT',
      timestamp: initial?.timestamp ?? Date.now(),
    }
  }

  get balance(): Readonly<Balance> {
    return this._balance
  }

  /**
   * Reserve funds for an order.
   * Throws if insufficient free balance.
   */
  reserve(amount: number, orderId: string): void {
    if (amount <= 0) return
    if (amount > this._balance.free) {
      throw new Error(`Insufficient free balance: need ${amount}, have ${this._balance.free}`)
    }
    this._balance.free -= amount
    this._balance.locked += amount
    this._reservations.set(orderId, amount)
    this._emit({ type: 'wallet:reserved', amount, orderId, timestamp: Date.now() })
  }

  /**
   * Release reserved funds for a cancelled/rejected order.
   */
  release(orderId: string): void {
    const amount = this._reservations.get(orderId)
    if (amount === undefined) return
    this._reservations.delete(orderId)
    this._balance.locked -= amount
    this._balance.free += amount
    this._emit({ type: 'wallet:released', amount, orderId, timestamp: Date.now() })
  }

  /**
   * Update open position count and unrealized PnL.
   */
  updatePositions(count: number, unrealizedPnL: number): void {
    this._openPositionCount = count
    this._balance.unrealizedPnL = unrealizedPnL
    this._emit({ type: 'wallet:margin-updated', marginUsed: this._balance.marginUsed, timestamp: Date.now() })
  }

  /**
   * Commit realized PnL after trade close.
   */
  commit(trade: Trade): void {
    const pnl = trade.realizedPnL
    this._balance.realizedPnL += pnl
    this._balance.total += pnl
    this._balance.free += pnl
    this._openPositionCount = Math.max(0, this._openPositionCount - 1)
    this._emit({ type: 'wallet:committed', tradeId: trade.id, realizedPnL: pnl, timestamp: Date.now() })
  }

  /**
   * Full balance sync from exchange.
   */
  sync(balance: Balance): void {
    const prevTotal = this._balance.total
    this._balance = { ...balance }
    const delta = this._balance.total - prevTotal
    this._emit({ type: 'wallet:balance-updated', balance: { ...this._balance }, timestamp: Date.now() })
    if (Math.abs(delta) > 0.0001) {
      this._emit({ type: 'wallet:equity-changed', total: this._balance.total, delta, timestamp: Date.now() })
    }
  }

  /**
   * Get immutable snapshot for TradeContext.
   */
  getSnapshot(): WalletSnapshot {
    return {
      total: this._balance.total,
      free: this._balance.free,
      locked: this._balance.locked,
      marginUsed: this._balance.marginUsed,
      unrealizedPnL: this._balance.unrealizedPnL,
      realizedPnL: this._balance.realizedPnL,
      currency: this._balance.currency,
      openPositionCount: this._openPositionCount,
      timestamp: Date.now(),
    }
  }

  /**
   * Subscribe to wallet events.
   * Returns unsubscribe function.
   */
  on(eventType: string, handler: WalletEventHandler): () => void {
    const handlers = this._handlers.get(eventType) ?? new Set()
    handlers.add(handler)
    this._handlers.set(eventType, handlers)
    return () => {
      handlers.delete(handler)
      if (handlers.size === 0) this._handlers.delete(eventType)
    }
  }

  private _emit(event: WalletEvent): void {
    const handlers = this._handlers.get(event.type)
    if (handlers) {
      for (const h of handlers) h(event)
    }
  }

  shutdown(): void {
    this._handlers.clear()
  }
}
