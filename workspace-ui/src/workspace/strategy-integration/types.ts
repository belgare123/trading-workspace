import type { Direction } from '../trade/types'
import type { StrategySignal } from '../strategy/types'
import type { WalletSnapshot } from '../wallet/types'
import type { StrategyBar } from '../strategy/definition'

// ── Strategy Integration: types & interfaces ──
// Sprint 5.7 — StrategyRuntime Integration

// ════════════════════════════════════════
// Signal mapping
// ════════════════════════════════════════

/** Mapped signal that StrategyExecutor passes to TradeLifecycleRuntime */
export interface ExecutorSignal {
  strategyId: string
  symbol: string
  direction: Direction
  price: number
  stopLoss?: number
  takeProfit?: number
  confidence?: number
  metadata?: Record<string, unknown>
  timestamp: number
}

export function mapStrategySignal(
  signal: StrategySignal,
  strategyId: string,
  price?: number,
  stopLoss?: number,
  takeProfit?: number,
): ExecutorSignal {
  return {
    strategyId,
    symbol: signal.symbol,
    direction: signal.direction === 'buy' ? 'long' : signal.direction === 'sell' ? 'short' : 'long',
    price: signal.price ?? price ?? 0,
    stopLoss: signal.meta?.stopLoss as number ?? stopLoss,
    takeProfit: signal.meta?.takeProfit as number ?? takeProfit,
    confidence: signal.confidence,
    metadata: { ...signal.meta, originalDirection: signal.direction },
    timestamp: signal.timestamp,
  }
}

// ════════════════════════════════════════
// StrategyContext — unified context for strategy onTick()
// ════════════════════════════════════════

export interface StrategyTick {
  symbol: string
  price: number
  bid: number
  ask: number
  timestamp: number
}

export interface StrategyCandle {
  symbol: string
  timeframe: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export interface StrategyContext {
  readonly strategyId: string
  readonly symbol: string
  readonly tick: StrategyTick
  readonly candles: readonly StrategyCandle[]
  readonly wallet: WalletSnapshot
  readonly hasOpenTrade: boolean
  readonly hasPendingOrder: boolean
  readonly clock: number
}

// ════════════════════════════════════════
// PositionGuard types
// ════════════════════════════════════════

export interface OpenTradeInfo {
  id: string
  symbol: string
  direction: Direction
  status: string
}

export interface GuardResult {
  allowed: boolean
  reason?: string
}

// ════════════════════════════════════════
// Scheduler types
// ════════════════════════════════════════

export type ScheduleTrigger = 'tick' | 'candle' | 'time'

export interface ScheduleConfig {
  trigger: ScheduleTrigger
  timeframe?: string
  intervalMs?: number
}

// ════════════════════════════════════════
// Strategy Integration config
// ════════════════════════════════════════

export interface StrategyIntegrationConfig {
  /** Default stop-loss % (applied if strategy doesn't provide one) */
  defaultStopLossPct: number
  /** Default take-profit % */
  defaultTakeProfitPct: number
  /** Minimum confidence threshold (0..1) */
  minConfidence: number
  /** Whether to enable position guard */
  enablePositionGuard: boolean
}
