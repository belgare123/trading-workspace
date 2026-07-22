// ── RetryEngine — retry/backoff/jitter/dead-letter ──

import { RetryPolicy, type RetryPolicyConfig } from '../../live/live/RetryPolicy'
import { BrokerError, NetworkError } from '../../live/live/BrokerError'
import type { RetryAttempt, RetryState } from './types'

export type RetryableFn<T> = (attempt: number) => Promise<T>

export interface RetryEngineConfig {
  policyConfig?: RetryPolicyConfig
  /** Max attempts before dead letter (default: 3) */
  maxAttempts?: number
  /** Whether to log debug info */
  debug?: boolean
}

const DEFAULTS: Required<RetryEngineConfig> = {
  maxAttempts: 3,
  debug: false,
  policyConfig: {},
}

export class RetryEngine {
  private policy: RetryPolicy
  private config: Required<RetryEngineConfig>
  /** Track retry state per call key */
  private states = new Map<string, RetryState>()

  constructor(config?: RetryEngineConfig) {
    this.config = { ...DEFAULTS, ...config }
    this.policy = new RetryPolicy(this.config.policyConfig)
  }

  /**
   * Execute a function with retry logic.
   * - NetworkError → retry with backoff
   * - ExchangeRejected → no retry, immediate fail
   * - Retry exhaustion → dead letter
   */
  async execute<T>(key: string, fn: RetryableFn<T>): Promise<{ result: T; retried: boolean }> {
    let state = this.states.get(key)
    if (!state) {
      state = { maxAttempts: this.config.maxAttempts, attempts: [], dead: false }
      this.states.set(key, state)
    }

    if (state.dead) {
      throw Object.assign(new Error(`Dead letter: ${key} — all retries exhausted`), { code: 'DEAD_LETTER', dead: true })
    }

    for (let attempt = 1; attempt <= state.maxAttempts; attempt++) {
      try {
        const result = await fn(attempt)
        // Success: clear state
        this.states.delete(key)
        return { result, retried: attempt > 1 }
      } catch (err) {
        const record: RetryAttempt = {
          attempt,
          delayMs: null,
          error: err,
          timestamp: Date.now(),
        }

        // Check if error is retryable via RetryPolicy
        const decision = this.policy.decide(attempt, err)

        if (decision.delayMs === null) {
          // Not retryable — fail immediately
          record.delayMs = null
          state.attempts.push(record)

          // Dead letter
          state.dead = true
          if (this.config.debug) {
            console.warn(`[RetryEngine] ${key} failed after ${attempt} attempt(s): no more retries`, decision.reason)
          }

          throw err
        }

        // Retryable — wait and continue
        record.delayMs = decision.delayMs
        state.attempts.push(record)

        if (this.config.debug) {
          console.info(`[RetryEngine] ${key} attempt ${attempt} failed, retry in ${decision.delayMs}ms`, String(err))
        }

        await new Promise(resolve => setTimeout(resolve, decision.delayMs!))
      }
    }

    // Exhausted max attempts — dead letter
    state.dead = true
    const err = Object.assign(new Error(`Dead letter: ${key} — max retries (${state.maxAttempts}) exhausted`), { code: 'DEAD_LETTER', dead: true })
    throw err
  }

  /** Check if a key is in dead letter */
  isDead(key: string): boolean {
    return this.states.get(key)?.dead === true
  }

  /** Reset a specific key or all keys */
  reset(key?: string): void {
    if (key) {
      this.states.delete(key)
    } else {
      this.states.clear()
    }
  }

  /** Get retry state for a key */
  getState(key: string): RetryState | undefined {
    return this.states.get(key)
  }
}
