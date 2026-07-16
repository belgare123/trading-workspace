// ── ExecutionContext — единый фасад для стратегии ──
//
// Стратегия НЕ имеет прямого доступа к StrategyRuntime, StrategyRegistry
// или любым другим внутренним компонентам платформы.
//
// Вместо этого каждая стратегия получает ExecutionContext при инициализации:
//
//   create(ctx: ExecutionContext): Record<string, unknown>
//   onBar(ctx: StrategyContext): StrategySignal | null
//
//   Где StrategyContext.bar — текущая свеча
//   А ctx (ExecutionContext) — фасад для всех внешних сервисов.
//
// Это полностью отвязывает стратегии от внутренней архитектуры платформы.
// Backend, Runtime или индикаторы можно заменить — ни одна стратегия не изменится.
//
// @since 3.4.2

import type { MarketContext } from './MarketContext'
import type { OrderContext } from './OrderContext'
import type { PositionContext } from './PositionContext'
import type { PortfolioContext } from './PortfolioContext'
import type { TimeContext } from './TimeContext'
import type { IndicatorContext } from './IndicatorContext'

export interface ExecutionContext {
  readonly market: MarketContext
  readonly orders: OrderContext
  readonly position: PositionContext
  readonly portfolio: PortfolioContext
  readonly time: TimeContext
  readonly indicators: IndicatorContext

  /** Произвольное хранилище состояния стратегии */
  readonly state: Record<string, unknown>
}
