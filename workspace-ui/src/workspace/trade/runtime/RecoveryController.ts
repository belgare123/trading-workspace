// ── RecoveryController ──

import { Trade } from '../Trade'
import { Direction } from '../types'
import type { IRecoveryGateway, PositionSnapshot } from './interfaces'

/**
 * RecoveryController handles recovery after restart:
 * 1. Fetch open positions from exchange (via Gateway)
 * 2. Create Trade objects for each open position (Managing state)
 * 3. Fetch active orders and reattach to trades
 * 4. Register recovered trades back in the Runtime
 */
export class RecoveryController {
  /**
   * Recover trades from exchange state.
   * After restart: exchange still has open positions and active orders.
   * We recreate Trades in Managing state and register them with the Runtime.
   */
  async recover(
    gateway: IRecoveryGateway,
    registerTrade: (trade: Trade) => void,
  ): Promise<Trade[]> {
    const recovered: Trade[] = []

    // 1. Fetch open positions
    const positions = await gateway.getPositions()
    if (positions.length === 0) {
      return recovered  // Nothing to recover
    }

    // 2. For each position, create a Trade in Managing state
    for (const pos of positions) {
      const trade = this.createTradeFromPosition(pos)
      recovered.push(trade)
      registerTrade(trade)
    }

    // 3. Fetch active orders and attach to trades
    // (For Sprint 5.2, basic order recovery — full reconciliation in Sprint 5.3)
    try {
      const orders = await gateway.getOrders()
      for (const order of orders) {
        const trade = recovered.find(t => t.symbol === order.symbol)
        if (trade) {
          trade.orderIds.push(order.orderId)
        }
      }
    } catch {
      // Order recovery is best-effort — continue without it
    }

    return recovered
  }

  /** Create a Trade in Managing state from a position snapshot */
  private createTradeFromPosition(pos: PositionSnapshot): Trade {
    const trade = Trade.create({
      strategyId: 'recovery',
      symbol: pos.symbol,
      direction: pos.direction === 'long' ? Direction.Long : Direction.Short,
    })

    // Restore entry record from position data
    const restoredEntry = {
      price: pos.averageEntryPrice,
      quantity: pos.quantity,
      quoteQuantity: pos.averageEntryPrice * pos.quantity,
      filledAt: 0,     // unknown after restart
      fee: 0,
    }

    // Manually set the entry (bypass FSM by setting internal state)
    // We use the trade's addEntryFill to set entry, then complete
    // Since we can't call private fields directly, we use the public API
    trade.setEntryPending('recovered-entry')
    trade.addEntryFill({
      id: 'recovery-fill',
      orderId: 'recovered',
      tradeId: trade.id,
      symbol: pos.symbol,
      side: pos.direction === 'long' ? 'buy' as const : 'sell' as const,
      price: pos.averageEntryPrice,
      quantity: pos.quantity,
      quoteQuantity: pos.averageEntryPrice * pos.quantity,
      fee: { asset: 'USDT', amount: 0, rate: 0, currency: 'USDT' },
      timestamp: pos.openedAt || Date.now(),
    })
    trade.completeEntry()
    trade.setManaging()

    // Restore PnL
    trade.updateUnrealizedPnL(pos.unrealizedPnl)
    trade.metadata.realizedPnLAtRecovery = pos.realizedPnl
    trade.metadata.recoveredAt = Date.now()
    trade.metadata.recoveryReason = 'post-restart'

    return trade
  }
}
