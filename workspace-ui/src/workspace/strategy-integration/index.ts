// ── Strategy Integration: barrel ──
// Sprint 5.7

export { StrategyExecutor } from './StrategyExecutor'
export type { ExecutorSignal } from './types'
export { mapStrategySignal, type StrategyContext, type StrategyTick, type StrategyCandle } from './types'
export { StrategyContextFactory } from './StrategyContext'
export { PositionGuard } from './PositionGuard'
export type { GuardResult } from './types'
export { StrategyRegistry } from './StrategyRegistry'
export type { ManagedStrategy } from './StrategyRegistry'
export { StrategyScheduler } from './StrategyScheduler'
export type { TickHandler } from './StrategyScheduler'
