// ── TradeLedger — Records individual trades (fills) ──
//
// Immutable: trades are appended, never modified.
//
// @since 3.5.1

import type { TradeRecord, Fill, Order } from '../types'

export class TradeLedger {
  private trades: TradeRecord[] = []

  /** Record a single fill as a trade */
  record(fill: Fill, order: Order, realizedPnl: number): TradeRecord {
    const trade: TradeRecord = {
      id: `trade-${fill.id}`,
      orderId: order.id,
      strategyId: order.strategyId,
      symbol: fill.symbol,
      side: fill.side,
      quantity: fill.quantity,
      price: fill.price,
      commission: fill.commission,
      realizedPnl,
      timestamp: fill.timestamp,
    }
    this.trades.push(trade)
    return trade
  }

  /** All recorded trades */
  all(): TradeRecord[] {
    return [...this.trades]
  }

  /** Trades for a specific strategy */
  byStrategy(strategyId: string): TradeRecord[] {
    return this.trades.filter(t => t.strategyId === strategyId)
  }

  /** Trades for a specific symbol */
  bySymbol(symbol: string): TradeRecord[] {
    return this.trades.filter(t => t.symbol === symbol)
  }

  /** Total number of trades */
  get size(): number {
    return this.trades.length
  }

  /** Total commission across all trades */
  get totalCommission(): number {
    return this.trades.reduce((s, t) => s + t.commission, 0)
  }

  /** Total realized PnL */
  get totalRealizedPnl(): number {
    return this.trades.reduce((s, t) => s + t.realizedPnl, 0)
  }

  clear(): void {
    this.trades = []
  }
}
