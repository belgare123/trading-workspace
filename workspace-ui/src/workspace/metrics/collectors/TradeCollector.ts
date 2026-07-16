// ── TradeCollector — Collects trades from ExecutionEventBus ──
//
// Listens to TRADE_RECORDED events. Provides trade data for metrics.
//
// @since 3.5.2

import type { TradeRecord, Collector, EventBusHandle } from '../types'

export class TradeCollector implements Collector {
  readonly id = 'trade-collector'
  private _trades: TradeRecord[] = []
  private unsub: (() => void) | null = null

  connect(bus: EventBusHandle): void {
    this.unsub = bus.on('TRADE_RECORDED', event => {
      this._trades.push(event.trade)
    })
  }

  get trades(): TradeRecord[] {
    return [...this._trades]
  }

  get size(): number {
    return this._trades.length
  }

  get grossProfit(): number {
    return this._trades
      .filter(t => t.realizedPnl > 0)
      .reduce((s, t) => s + t.realizedPnl, 0)
  }

  get grossLoss(): number {
    return Math.abs(
      this._trades
        .filter(t => t.realizedPnl < 0)
        .reduce((s, t) => s + t.realizedPnl, 0),
    )
  }

  get winningTrades(): number {
    return this._trades.filter(t => t.realizedPnl > 0).length
  }

  get losingTrades(): number {
    return this._trades.filter(t => t.realizedPnl < 0).length
  }

  get winRate(): number {
    const total = this._trades.length
    return total === 0 ? 0 : this.winningTrades / total
  }

  averageWin(): number {
    const wins = this._trades.filter(t => t.realizedPnl > 0)
    return wins.length === 0 ? 0 : wins.reduce((s, t) => s + t.realizedPnl, 0) / wins.length
  }

  averageLoss(): number {
    const losses = this._trades.filter(t => t.realizedPnl < 0)
    return losses.length === 0 ? 0 : Math.abs(losses.reduce((s, t) => s + t.realizedPnl, 0)) / losses.length
  }

  maxConsecutiveWins(): number {
    let max = 0
    let current = 0
    for (const t of this._trades) {
      if (t.realizedPnl > 0) {
        current++
        max = Math.max(max, current)
      } else {
        current = 0
      }
    }
    return max
  }

  maxConsecutiveLosses(): number {
    let max = 0
    let current = 0
    for (const t of this._trades) {
      if (t.realizedPnl < 0) {
        current++
        max = Math.max(max, current)
      } else {
        current = 0
      }
    }
    return max
  }

  reset(): void {
    this._trades = []
    this.unsub?.()
    this.unsub = null
  }
}
