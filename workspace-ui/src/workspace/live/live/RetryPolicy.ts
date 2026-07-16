/**
 * RetryPolicy.ts — Configurable retry strategies for broker operations
 *
 * Supports:
 * - Immediate (instant retry up to N attempts)
 * - Linear (fixed delay between attempts)
 * - Exponential (2^attempt * baseDelay + jitter)
 * - Jitter (randomized delay for thundering herd avoidance)
 *
 * Used by OrderRouter and RateLimiter to determine if and when to retry.
 *
 * @since 4.6.1
 */

import { BrokerError } from './BrokerError'

// ── Retry Strategy ──

export type RetryStrategy = 'immediate' | 'linear' | 'exponential' | 'jitter'

export interface RetryPolicyConfig {
  /** Maximum number of retry attempts (0 = no retries, default: 3) */
  maxAttempts?: number
  /** Base delay in ms (default: 1_000) */
  baseDelayMs?: number
  /** Maximum delay in ms (default: 60_000) */
  maxDelayMs?: number
  /** Strategy type (default: 'exponential') */
  strategy?: RetryStrategy
  /** Whether to retry on non-retryable errors (default: false) */
  retryNonRetryable?: boolean
  /** Specific error codes to always retry (e.g. ['NETWORK_ERROR', 'RATE_LIMIT_ERROR']) */
  retryCodes?: string[]
}

const DEFAULTS: Required<RetryPolicyConfig> = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  strategy: 'exponential',
  retryNonRetryable: false,
  retryCodes: [],
}

/**
 * Result of a retry decision.
 * - `delayMs: null`  → do not retry
 * - `delayMs: number` → retry after this many ms
 */
export interface RetryDecision {
  attempt: number
  delayMs: number | null
  reason?: string
}

export class RetryPolicy {
  private config: Required<RetryPolicyConfig>

  constructor(config?: RetryPolicyConfig) {
    this.config = { ...DEFAULTS, ...config }
  }

  /** Returns a RetryDecision for the given attempt number (1-based) and error */
  decide(attempt: number, error: unknown): RetryDecision {
    // Exhausted attempts
    if (attempt > this.config.maxAttempts) {
      return { attempt, delayMs: null, reason: `maxAttempts (${this.config.maxAttempts}) exceeded` }
    }

    // Check if error is retryable
    const isRetryable = this.isErrorRetryable(error)
    if (!isRetryable) {
      return { attempt, delayMs: null, reason: 'error is not retryable' }
    }

    return { attempt, delayMs: this.calculateDelay(attempt) }
  }

  /** Whether we should retry at all (convenience for calling code) */
  shouldRetry(attempt: number, error: unknown): boolean {
    return this.decide(attempt, error).delayMs !== null
  }

  // ── Helpers ──

  private isErrorRetryable(error: unknown): boolean {
    // Custom retry codes override
    if (error instanceof BrokerError) {
      if (this.config.retryCodes.length > 0 && this.config.retryCodes.includes(error.code)) {
        return true
      }
      if (error.isRetryable) return true
      if (this.config.retryNonRetryable) return true
      return false
    }

    // Non-BrokerError: assume retryable (network-level errors)
    return true
  }

  private calculateDelay(attempt: number): number {
    const { strategy, baseDelayMs, maxDelayMs } = this.config

    let delay: number

    switch (strategy) {
      case 'immediate':
        delay = 0
        break

      case 'linear':
        delay = baseDelayMs
        break

      case 'exponential':
        delay = baseDelayMs * Math.pow(2, attempt - 1)
        break

      case 'jitter':
        delay = baseDelayMs * (0.5 + Math.random() * 0.5) * Math.pow(2, attempt - 1)
        break

      default:
        delay = baseDelayMs * Math.pow(2, attempt - 1)
    }

    return Math.min(delay, maxDelayMs)
  }
}
