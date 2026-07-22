/**
 * TradeTelemetryHooks.ts — SLI hooks for TradeLifecycleRuntime
 *
 * Attaches to LifecycleEventBus events and records SLI measurements.
 * Zero modifications to TradeLifecycleRuntime core.
 *
 * @since 6.3.0
 */

import type { TradeLifecycleRuntime } from '../TradeLifecycleRuntime'
import type { LifecycleEventBus } from './LifecycleEventBus'
import { TradeEventType } from '../TradeLifecycleEvent'
import type { Trade } from '../Trade'
import { runtimeTelemetry } from '../../live/sli/RuntimeTelemetry'

/** Entry phase tracking — map tradeId → signal timestamp */
const entryTimestamps = new Map<string, number>()

/** Exit phase tracking — map tradeId → exit decision timestamp */
const exitTimestamps = new Map<string, number>()

/** Recovery tracking */
let recoveryStart = 0

/** Periodic active trade counter update interval (ms) */
let activeTradeTimer: ReturnType<typeof setInterval> | null = null

/**
 * Attach SLI recording to a TradeLifecycleRuntime's event bus.
 * Call once after TradeLifecycleRuntime construction.
 */
export function attachTradeTelemetry(runtime: TradeLifecycleRuntime): () => void {
  const unsubs: Array<() => void> = []

  // Track entry latency
  unsubs.push(runtime.eventBus.on(TradeEventType.TradeOpened, (trade: Trade) => {
    entryTimestamps.set(trade.id, Date.now())
  }))

  // When entry is filled, record entry latency
  unsubs.push(runtime.eventBus.on(TradeEventType.TradeEntryFilled, (trade: Trade) => {
    const signalTime = entryTimestamps.get(trade.id)
    if (signalTime) {
      runtimeTelemetry.trade.entryLatency.record(Date.now() - signalTime)
      entryTimestamps.delete(trade.id)
    }
    // Track throughput
    runtimeTelemetry.trade.tradeThroughput.record(1)
    updateActiveTrades(runtime)
  }))

  // Track exit latency
  unsubs.push(runtime.eventBus.on(TradeEventType.TradeExitPending, (trade: Trade) => {
    exitTimestamps.set(trade.id, Date.now())
  }))

  // When trade closes, record exit latency
  unsubs.push(runtime.eventBus.on(TradeEventType.TradeClosed, (trade: Trade) => {
    const exitTime = exitTimestamps.get(trade.id)
    if (exitTime) {
      runtimeTelemetry.trade.exitLatency.record(Date.now() - exitTime)
      exitTimestamps.delete(trade.id)
    }
    updateActiveTrades(runtime)
  }))

  // Track rejected/cancelled trades too
  unsubs.push(runtime.eventBus.on(TradeEventType.TradeRejected, () => updateActiveTrades(runtime)))
  unsubs.push(runtime.eventBus.on(TradeEventType.TradeCancelled, () => updateActiveTrades(runtime)))

  // Recovery
  unsubs.push(runtime.eventBus.on('recovery:start', () => {
    recoveryStart = Date.now()
  }))
  unsubs.push(runtime.eventBus.on('recovery:complete', () => {
    if (recoveryStart > 0) {
      runtimeTelemetry.trade.recoveryDuration.record(Date.now() - recoveryStart)
      recoveryStart = 0
    }
  }))

  // Periodic active trade count
  activeTradeTimer = setInterval(() => {
    updateActiveTrades(runtime)
  }, 10_000)

  // Initial count
  updateActiveTrades(runtime)

  return () => {
    unsubs.forEach(fn => fn())
    if (activeTradeTimer) {
      clearInterval(activeTradeTimer)
      activeTradeTimer = null
    }
    entryTimestamps.clear()
    exitTimestamps.clear()
  }
}

function updateActiveTrades(runtime: TradeLifecycleRuntime): void {
  const count = runtime.getActiveTrades().length
  runtimeTelemetry.trade.activeTrades.record(count)
}
