// ── PortfolioContext — портфельные метрики для стратегии ──
//
// Стратегия получает сводку портфеля через ctx.portfolio:
//   ctx.portfolio.equity()
//   ctx.portfolio.balance()
//   ctx.portfolio.pnl()
//   ctx.portfolio.drawdown()
//
// @since 3.4.2

export interface BalanceData {
  total: number
  free: number
  used: number
  currency: string
}

export interface PortfolioSummary {
  equity: number
  balance: BalanceData
  dayPnL: number
  totalPnL: number
  drawdown: number
  winRate: number
  totalTrades: number
}

export interface PortfolioContext {
  /** Текущая стоимость портфеля */
  equity(): Promise<number>

  /** Доступный баланс */
  balance(): Promise<BalanceData>

  /** Дневной PnL */
  dayPnL(): Promise<number>

  /** Полный PnL */
  totalPnL(): Promise<number>

  /** Текущая просадка */
  drawdown(): Promise<number>

  /** Полная сводка портфеля */
  summary(): Promise<PortfolioSummary>

  /** Событие обновления портфеля */
  onUpdate(cb: (summary: PortfolioSummary) => void): () => void
}
