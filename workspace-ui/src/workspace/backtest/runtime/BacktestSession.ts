// ── BacktestSession — Single backtest run ──
//
// First-class entity that encapsulates one backtest execution.
// Holds all runtime references and manages the main loop.
//
// @since 3.5.3

import type {
  BacktestConfig,
  BacktestProgress,
  BacktestSessionInfo,
  BacktestFeed,
  StrategyExecutor,
} from '../types'
import type { MarketSnapshot } from '../../execution/types'
import { SessionState } from './SessionState'
import { SessionClock } from '../control/SessionClock'
import { PlaybackController } from '../control/PlaybackController'
import { StepController } from '../control/StepController'
import type { ExecutionRuntime } from '../../execution/runtime/ExecutionRuntime'
import type { ExecutionConfig } from '../../execution/types'
import type { MetricsRuntime } from '../../metrics/runtime/MetricsRuntime'
import type { MetricsSnapshot } from '../../metrics/serialization/MetricsSnapshot'

export class BacktestSession {
  readonly id: string
  readonly name: string
  readonly config: BacktestConfig
  readonly state: SessionState
  readonly clock: SessionClock
  readonly playback: PlaybackController
  readonly step: StepController
  readonly feed: BacktestFeed

  private _execution: ExecutionRuntime | null = null
  private _metrics: MetricsRuntime | null = null
  private _strategy: StrategyExecutor | null = null
  private _results: MetricsSnapshot | null = null

  private _barsProcessed = 0
  private _startTime: number | null = null
  private _completionTime: number | null = null

  private _barHandler: ((market: MarketSnapshot) => Promise<void>) | null = null

  constructor(
    config: BacktestConfig,
    feed: BacktestFeed,
  ) {
    this.id = config.id
    this.name = config.name
    this.config = config
    this.state = new SessionState()
    this.clock = new SessionClock()
    this.playback = new PlaybackController()
    this.step = new StepController()
    this.feed = feed
  }

  // ═══════════════════════════════════
  // Runtime registration
  // ═══════════════════════════════════

  attachExecution(runtime: ExecutionRuntime): void {
    this._execution = runtime
  }

  attachMetrics(runtime: MetricsRuntime): void {
    this._metrics = runtime
  }

  attachStrategy(executor: StrategyExecutor): void {
    this._strategy = executor
  }

  /** Set a custom bar handler for the main loop */
  onBar(handler: (market: MarketSnapshot) => Promise<void>): void {
    this._barHandler = handler
  }

  get execution(): ExecutionRuntime | null {
    return this._execution
  }

  get metrics(): MetricsRuntime | null {
    return this._metrics
  }

  get strategy(): StrategyExecutor | null {
    return this._strategy
  }

  get results(): MetricsSnapshot | null {
    return this._results
  }

  // ═══════════════════════════════════
  // Progress
  // ═══════════════════════════════════

  get barsProcessed(): number {
    return this._barsProcessed
  }

  get progress(): BacktestProgress {
    const totalBars = Math.min(
      this.config.maxBars ?? this.feed.totalBars,
      this.feed.totalBars,
    )
    const elapsedMs = this._startTime ? Date.now() - this._startTime : 0
    const percent = totalBars === 0 ? 0 : (this._barsProcessed / totalBars) * 100
    const remaining = totalBars - this._barsProcessed
    const barsPerSecond = elapsedMs > 0 ? (this._barsProcessed / elapsedMs) * 1000 : 0
    const etaMs = barsPerSecond > 0 ? (remaining / barsPerSecond) * 1000 : 0

    return {
      barsProcessed: this._barsProcessed,
      totalBars,
      percent: Math.min(percent, 100),
      elapsedMs,
      etaMs,
      barsPerSecond,
    }
  }

  get info(): BacktestSessionInfo {
    return {
      id: this.id,
      name: this.name,
      status: this.state.status,
      config: this.config,
      progress: this.progress,
      startedAt: this._startTime,
      completedAt: this._completionTime,
      error: this.state.error,
    }
  }

  // ═══════════════════════════════════
  // Main loop
  // ═══════════════════════════════════

  /** Initialize and start the backtest */
  async start(): Promise<void> {
    this.state.transitionTo('initializing')

    if (!this._execution) throw new Error('ExecutionRuntime not attached')
    if (!this._strategy) throw new Error('Strategy executor not attached')

    // Init execution
    const execConfig: ExecutionConfig = {
      initialCash: this.config.initialCash,
      slippageModel: this.config.execution?.slippageModel ?? { calculate: () => 0 },
      commissionModel: this.config.execution?.commissionModel ?? { calculate: () => 0 },
      fillModel: this.config.execution?.fillModel ?? {
        execute: (order, market) => ({
          fills: [{
            id: `fill-${order.id}`,
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            price: order.averagePrice,
            commission: 0,
            commissionAsset: 'USDT',
            slippage: 0,
            timestamp: market?.timestamp ?? Date.now(),
          }],
          remainingQuantity: 0,
          status: 'filled' as const,
        }),
      },
    }
    this._execution.initialize(execConfig)

    // Connect metrics to execution event bus
    if (this._metrics) {
      this._metrics.connect(this._execution.events)
    }

    // Init strategy
    await this._strategy.init(this.config)

    // Start main loop
    this.state.transitionTo('running')
    this._startTime = Date.now()
    this.feed.reset()

    await this.runLoop()
  }

  private async runLoop(): Promise<void> {
    try {
      const maxBars = this.config.maxBars ?? Infinity
      const spread = this.config.spread

      while (this.feed.hasNext() && this._barsProcessed < maxBars) {
        if (this.state.status === 'paused') {
          await this.waitForResume()
        }
        if (this.state.status === 'failed') break

        // 1. Feed: advance and build market snapshot
        const market = this.feed.next(spread)

        // 2. Clock
        this.clock.tick(market.timestamp)

        // 3. Strategy: process bar
        if (this._barHandler) {
          await this._barHandler(market)
        } else if (this._strategy && market.bar) {
          await this._strategy.onBar({
            open: market.bar.open,
            high: market.bar.high,
            low: market.bar.low,
            close: market.bar.close,
            volume: market.bar.volume,
            timestamp: market.timestamp,
          })
        }

        // 4. Execution: process market (evaluate orders)
        this._execution!.onBar(market)

        // 5. Metrics: auto-collected via event bus connection
        //    (metrics runtime listens to execution events)

        // 6. Progress
        this._barsProcessed++

        // 7. Step mode: yield control
        if (this.playback.state.isStepMode) {
          this.playback.state.stepForward = false
          return // exit loop, caller can resume
        }
      }

      // Normal completion
      this._completionTime = Date.now()
      this.state.transitionTo('completed')

      // Collect results
      if (this._metrics) {
        this._results = this._metrics.snapshot()
      }
    } catch (err) {
      this.state.fail(err instanceof Error ? err.message : String(err))
    }
  }

  /** Pause execution */
  pause(): void {
    if (this.state.status === 'running') {
      this.state.transitionTo('paused')
    }
  }

  /** Resume execution */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.transitionTo('running')
    }
  }

  /** Step forward one bar */
  stepOnce(): void {
    this.playback.stepForward()
    if (this.state.status === 'paused' || this.state.status === 'running') {
      this.state.transitionTo('running')
      this.runLoop()
    }
  }

  /** Stop and reset session */
  reset(): void {
    this.state.reset()
    this._barsProcessed = 0
    this._startTime = null
    this._completionTime = null
    this._results = null
    this.clock.reset()
    this.feed.reset()
  }

  /** Wait until resumed or failed */
  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.state.status === 'running' || this.state.status === 'failed' || this.state.status === 'completed') {
          clearInterval(check)
          resolve()
        }
      }, 100)
    })
  }
}
