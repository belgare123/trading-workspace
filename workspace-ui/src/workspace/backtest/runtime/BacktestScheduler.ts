// ── BacktestScheduler — Schedule and coordinate session execution ──
//
// Runs sessions sequentially or in parallel (when dependencies allow).
// No business logic — pure scheduling.
//
// @since 3.5.3

import type { BacktestConfig, BacktestFeed, BacktestReport } from '../types'
import type { BacktestRuntime } from './BacktestRuntime'
import type { BacktestSession } from './BacktestSession'

type SessionTask = {
  session: BacktestSession
  resolve: (report: BacktestReport) => void
  reject: (err: Error) => void
}

export class BacktestScheduler {
  private _queue: SessionTask[] = []
  private _running: boolean = false
  private _maxConcurrent = 1
  private _onProgress: ((completed: number, total: number) => void) | null = null
  private readonly _runtime: BacktestRuntime

  constructor(runtime: BacktestRuntime) {
    this._runtime = runtime
  }

  get queueLength(): number {
    return this._queue.length
  }

  get isRunning(): boolean {
    return this._running
  }

  setMaxConcurrent(n: number): void {
    this._maxConcurrent = Math.max(1, n)
  }

  onProgress(cb: (completed: number, total: number) => void): void {
    this._onProgress = cb
  }

  /** Enqueue a session for execution */
  async enqueue(
    config: BacktestConfig,
    feed: BacktestFeed,
  ): Promise<BacktestReport> {
    const session = this._runtime.createSession(config, feed)

    return new Promise((resolve, reject) => {
      this._queue.push({ session, resolve, reject })
      if (!this._running) {
        this.processQueue()
      }
    })
  }

  /** Enqueue multiple sessions (parallel) */
  async enqueueAll(
    configs: { config: BacktestConfig; feed: BacktestFeed }[],
  ): Promise<BacktestReport[]> {
    return Promise.all(configs.map(c => this.enqueue(c.config, c.feed)))
  }

  /** Run a single session immediately */
  async run(session: BacktestSession): Promise<BacktestReport> {
    return this.executeSession(session)
  }

  // ═══════════════════════════════════
  // Internal
  // ═══════════════════════════════════

  private async processQueue(): Promise<void> {
    if (this._running) return
    this._running = true

    const total = this._queue.length
    let completed = 0

    while (this._queue.length > 0 && this._running) {
      const batch: SessionTask[] = this._queue.splice(0, this._maxConcurrent)
      await Promise.all(
        batch.map(async (task) => {
          try {
            const report = await this.executeSession(task.session)
            task.resolve(report)
          } catch (err) {
            task.reject(err instanceof Error ? err : new Error(String(err)))
          } finally {
            completed++
            this._onProgress?.(completed, total)
          }
        }),
      )
    }

    this._running = false
  }

  private async executeSession(session: BacktestSession): Promise<BacktestReport> {
    const startedAt = Date.now()

    try {
      await session.start()
      const metrics = session.results!

      return {
        sessionId: session.id,
        name: session.name,
        config: session.config,
        metrics,
        duration: {
          startedAt,
          completedAt: Date.now(),
          elapsedMs: Date.now() - startedAt,
          barsProcessed: session.barsProcessed,
          barsPerSecond:
            Date.now() - startedAt > 0
              ? (session.barsProcessed / (Date.now() - startedAt)) * 1000
              : 0,
        },
      }
    } catch (err) {
      return {
        sessionId: session.id,
        name: session.name,
        config: session.config,
        metrics: null,
        duration: {
          startedAt,
          completedAt: Date.now(),
          elapsedMs: Date.now() - startedAt,
          barsProcessed: session.barsProcessed,
          barsPerSecond: 0,
        },
        errors: [err instanceof Error ? err.message : String(err)],
      }
    }
  }

  /** Cancel all queued sessions */
  cancelAll(): void {
    for (const task of this._queue) {
      task.reject(new Error('Queued task cancelled'))
    }
    this._queue = []
    this._running = false
  }

  /** Stop processing queue after current batch */
  stop(): void {
    this._running = false
  }
}
