// ── BacktestRuntime — Orchestrator for backtest sessions ──
//
// Top-level manager. Creates, tracks, and coordinates sessions.
// No business logic — pure orchestration.
//
// @since 3.5.3

import { nanoid } from 'nanoid'
import type {
  BacktestConfig,
  BacktestSessionInfo,
  BacktestFeed,
  StrategyExecutor,
} from '../types'
import type { MarketSnapshot } from '../../execution/types'
import { BacktestSession } from './BacktestSession'
import { BacktestScheduler } from './BacktestScheduler'
import type { ExecutionRuntime } from '../../execution/runtime/ExecutionRuntime'
import type { MetricsRuntime } from '../../metrics/runtime/MetricsRuntime'

export class BacktestRuntime {
  readonly sessions: Map<string, BacktestSession> = new Map()
  readonly scheduler: BacktestScheduler

  private _executionDefaults: (() => ExecutionRuntime) | null = null
  private _metricsDefaults: (() => MetricsRuntime) | null = null
  private _strategyFactory: ((config: BacktestConfig) => StrategyExecutor) | null = null

  constructor() {
    this.scheduler = new BacktestScheduler(this)
  }

  // ═══════════════════════════════════
  // Factories
  // ═══════════════════════════════════

  /** Set default execution runtime factory (called per session) */
  setExecutionFactory(factory: () => ExecutionRuntime): void {
    this._executionDefaults = factory
  }

  /** Set default metrics runtime factory */
  setMetricsFactory(factory: () => MetricsRuntime): void {
    this._metricsDefaults = factory
  }

  /** Set strategy factory (called per session with config) */
  setStrategyFactory(factory: (config: BacktestConfig) => StrategyExecutor): void {
    this._strategyFactory = factory
  }

  // ═══════════════════════════════════
  // Session lifecycle
  // ═══════════════════════════════════

  /** Create a new backtest session */
  createSession(config: BacktestConfig, feed: BacktestFeed): BacktestSession {
    // Assign ID if not set
    if (!config.id) {
      config.id = `bt_${nanoid(12)}`
    }

    const session = new BacktestSession(config, feed)

    // Attach runtimes
    if (this._executionDefaults) {
      session.attachExecution(this._executionDefaults())
    }
    if (this._metricsDefaults) {
      session.attachMetrics(this._metricsDefaults())
    }
    if (this._strategyFactory) {
      session.attachStrategy(this._strategyFactory(config))
    }

    // Default bar handler: Strategy → Execution pipeline
    if (session.strategy && session.execution) {
      session.onBar(async (market: MarketSnapshot) => {
        const bar = market.bar
        if (!bar) return
        await session.strategy!.onBar({
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          timestamp: market.timestamp,
        })
      })
    }

    this.sessions.set(session.id, session)
    return session
  }

  /** Get session by id */
  getSession(id: string): BacktestSession | undefined {
    return this.sessions.get(id)
  }

  /** Remove a session */
  removeSession(id: string): boolean {
    return this.sessions.delete(id)
  }

  /** List all sessions */
  listSessions(): BacktestSessionInfo[] {
    return Array.from(this.sessions.values()).map(s => s.info)
  }

  /** Get active sessions (running/paused) */
  get activeSessions(): BacktestSession[] {
    return Array.from(this.sessions.values()).filter(s => s.state.isRunning || s.state.status === 'paused')
  }

  // ═══════════════════════════════════
  // Status
  // ═══════════════════════════════════

  getStatus() {
    return {
      id: 'backtest-runtime',
      totalSessions: this.sessions.size,
      activeCount: this.activeSessions.length,
      completedCount: Array.from(this.sessions.values()).filter(s => s.state.status === 'completed').length,
      failedCount: Array.from(this.sessions.values()).filter(s => s.state.status === 'failed').length,
    }
  }

  /** Clean up all sessions */
  clear(): void {
    for (const session of this.sessions.values()) {
      if (session.state.isRunning) {
        session.state.transitionTo('completed')
      }
    }
    this.sessions.clear()
  }
}
