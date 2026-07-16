// ── Strategy Foundation types ──
// Shared types for the Strategy Studio subsystem.
//
// @since 3.4.1

export type StrategyStatus = 'created' | 'running' | 'paused' | 'stopped' | 'error'

export type SignalDirection = 'buy' | 'sell' | 'close'

export interface StrategySignal {
  /** Signal direction */
  direction: SignalDirection
  /** Symbol/pair */
  symbol: string
  /** Price at signal time */
  price: number
  /** Signal strength/confidence (0..1) */
  confidence?: number
  /** Optional metadata */
  meta?: Record<string, unknown>
  /** When the signal was generated */
  timestamp: number
}

export interface StrategyInstanceData {
  /** Unique instance id */
  id: string
  /** Definition id this instance was created from */
  definitionId: string
  /** Current status */
  status: StrategyStatus
  /** Display name */
  name: string
  /** Symbol/pair being traded */
  symbol: string
  /** Timeframe (e.g. '1h', '4h', '1d') */
  timeframe: string
  /** Parameters passed at creation */
  params: Record<string, unknown>
  /** Runtime state (persisted between ticks) */
  state: Record<string, unknown>
  /** Signals emitted so far */
  signals: StrategySignal[]
  /** Error message if status === 'error' */
  error?: string
  /** When the instance was created */
  createdAt: number
  /** When the instance was last updated */
  updatedAt: number
}

export interface StrategySummary {
  id: string
  name: string
  status: StrategyStatus
  symbol: string
  timeframe: string
  signalsTotal: number
  signalsToday: number
  lastSignal?: StrategySignal
}
