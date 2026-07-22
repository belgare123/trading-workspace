/**
 * StrategyTelemetryHooks.ts — SLI hooks for StrategyRuntime
 *
 * Attaches to StrategyRuntime events and records SLI measurements.
 * Zero modifications to StrategyRuntime core.
 *
 * @since 6.3.0
 */

import type { StrategyRuntime } from './StrategyRuntime'
import type { StrategySignal, StrategyInstanceData } from '../types'
import { runtimeTelemetry } from '../../live/sli/RuntimeTelemetry'

/** Track signal generation timestamps — map instanceId → bar received timestamp */
const tickTimestamps = new Map<string, number>()

/** Periodic active strategy count update interval (ms) */
let activeStrategyTimer: ReturnType<typeof setInterval> | null = null

/**
 * Attach SLI recording to a StrategyRuntime.
 * Call once after StrategyRuntime construction.
 */
export function attachStrategyTelemetry(runtime: StrategyRuntime): () => void {
  const unsubs: Array<() => void> = []

  // Track signal generation timing
  unsubs.push(runtime.on('signal', (_signal: StrategySignal, _instance: StrategyInstanceData) => {
    const tickTime = tickTimestamps.get(_instance.id)
    if (tickTime) {
      runtimeTelemetry.strategy.signalLatency.record(Date.now() - tickTime)
      tickTimestamps.delete(_instance.id)
    }
    runtimeTelemetry.strategy.signalsTotal.record(1)
    runtimeTelemetry.strategy.signalsPerSec.record(1)
    updateActiveStrategies(runtime)
  }))

  // Track active strategy count on lifecycle changes
  const instanceEvents = ['instance:added', 'instance:started', 'instance:paused', 'instance:stopped', 'instance:removed'] as const
  for (const event of instanceEvents) {
    unsubs.push(runtime.on(event, () => updateActiveStrategies(runtime)))
  }

  // Periodic update of active strategy count
  activeStrategyTimer = setInterval(() => {
    updateActiveStrategies(runtime)
  }, 10_000)

  // Initial count
  updateActiveStrategies(runtime)

  return () => {
    unsubs.forEach(fn => fn())
    if (activeStrategyTimer) {
      clearInterval(activeStrategyTimer)
      activeStrategyTimer = null
    }
    tickTimestamps.clear()
  }
}

/** Mark bar received time for latency tracking */
export function markBarReceived(instanceId: string): void {
  tickTimestamps.set(instanceId, Date.now())
}

function updateActiveStrategies(runtime: StrategyRuntime): void {
  runtimeTelemetry.strategy.activeStrategies.record(runtime.runningCount)
}
