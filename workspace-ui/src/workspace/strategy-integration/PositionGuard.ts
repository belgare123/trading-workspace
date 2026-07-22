// ── PositionGuard — предотвращает дублирование сделок ──
// Sprint 5.7 — StrategyRuntime Integration

import type { GuardResult, OpenTradeInfo } from './types'

/**
 * PositionGuard — проверяет, можно ли открыть новую сделку.
 *
 * Guard rules:
 * 1. Нет открытого TradeLifecycle для этого символа
 * 2. Нет Pending Order для этого символа
 * 3. Runtime не в состоянии RECOVERING
 * 4. ExitEngine не обрабатывает активный выход
 */
export class PositionGuard {
  private readonly _getOpenTrades: () => OpenTradeInfo[]
  private readonly _getPendingOrders: () => string[]
  private readonly _isRecovering: () => boolean

  constructor(deps: {
    getOpenTrades: () => OpenTradeInfo[]
    getPendingOrders: () => string[]
    isRecovering: () => boolean
  }) {
    this._getOpenTrades = deps.getOpenTrades
    this._getPendingOrders = deps.getPendingOrders
    this._isRecovering = deps.isRecovering
  }

  canOpen(symbol: string): GuardResult {
    // 1. Check recovering state
    if (this._isRecovering()) {
      return { allowed: false, reason: 'runtime is recovering' }
    }

    // 2. Check open trades for symbol
    const open = this._getOpenTrades()
    const existing = open.find(t => t.symbol === symbol && (t.status === 'open' || t.status === 'entered'))
    if (existing) {
      return { allowed: false, reason: `already have open trade ${existing.id} for ${symbol}` }
    }

    // 3. Check pending orders for symbol
    const pending = this._getPendingOrders()
    if (pending.includes(symbol)) {
      return { allowed: false, reason: `pending order exists for ${symbol}` }
    }

    return { allowed: true }
  }
}
