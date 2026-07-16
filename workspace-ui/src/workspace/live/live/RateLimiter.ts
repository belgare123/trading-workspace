/**
 * RateLimiter.ts — Sliding-window rate limiter for broker API calls
 *
 * Implements a token-bucket-style rate limiter that sits between
 * OrderRouter / LiveProvider and the BrokerAdapter.
 *
 * Features:
 * - Per-operation-type limits (orders, cancels, queries)
 * - Sliding time window prevents burst abuse
 * - Configurable max tokens and refill rate
 * - RateLimitExceeded error for caller-facing rejection
 *
 * Flow:
 *   OrderRouter → RateLimiter.consume('placeOrder')
 *     → if tokens remaining: pass through, decrement
 *     → if no tokens: throw RateLimitExceeded (not a BrokerError — caller level)
 *
 * @since 4.6.1
 */

// ── Rate Limit Exceeded (application-level, not a BrokerError) ──

export class RateLimitExceeded extends Error {
  readonly retryAfterMs: number
  readonly operationType: string

  constructor(operationType: string, retryAfterMs: number) {
    super(`Rate limit exceeded for ${operationType}. Retry after ${retryAfterMs}ms`)
    this.name = 'RateLimitExceeded'
    this.operationType = operationType
    this.retryAfterMs = retryAfterMs
  }
}

// ── Operation Types ──

export type OperationType = 'placeOrder' | 'cancelOrder' | 'replaceOrder' | 'getOrder' | 'getOpenOrders' | 'getPositions' | 'getAccountInfo' | 'subscribeOrders' | 'subscribeFills' | 'subscribePositions' | 'subscribeBalances'

// ── Limit Configuration ──

export interface RateLimitConfig {
  /** Maximum number of operations in the window */
  maxTokens: number
  /** Window size in ms (default: 1_000 = 1 second) */
  windowMs?: number
  /** Number of tokens to refill per window (default: same as maxTokens) */
  refillRate?: number
  /** Whether to allow burst (consume all tokens at once, default: false) */
  allowBurst?: boolean
}

const DEFAULT_LIMIT_CONFIG: Required<RateLimitConfig> = {
  maxTokens: 10,
  windowMs: 1_000,
  refillRate: 10,
  allowBurst: false,
}

// ── Per-operation state ──

interface BucketState {
  tokens: number
  lastRefill: number
  config: Required<RateLimitConfig>
}

export class RateLimiter {
  /** Default limits for standard operation types */
  static readonly DEFAULT_LIMITS: Record<OperationType, RateLimitConfig> = {
    placeOrder: { maxTokens: 5, windowMs: 1_000 },
    cancelOrder: { maxTokens: 10, windowMs: 1_000 },
    replaceOrder: { maxTokens: 5, windowMs: 1_000 },
    getOrder: { maxTokens: 20, windowMs: 1_000 },
    getOpenOrders: { maxTokens: 10, windowMs: 1_000 },
    getPositions: { maxTokens: 10, windowMs: 1_000 },
    getAccountInfo: { maxTokens: 5, windowMs: 1_000 },
    subscribeOrders: { maxTokens: 5, windowMs: 60_000 },
    subscribeFills: { maxTokens: 5, windowMs: 60_000 },
    subscribePositions: { maxTokens: 5, windowMs: 60_000 },
    subscribeBalances: { maxTokens: 5, windowMs: 60_000 },
  }

  private buckets: Map<string, BucketState> = new Map()

  constructor(limits?: Partial<Record<OperationType, RateLimitConfig>>) {
    // Initialize with defaults, override any custom limits
    const allLimits = { ...RateLimiter.DEFAULT_LIMITS, ...limits } as Record<OperationType, RateLimitConfig>
    for (const [op, config] of Object.entries(allLimits)) {
      this.setLimit(op as OperationType, config)
    }
  }

  /** Set or update rate limit for an operation type */
  setLimit(operation: OperationType, config: RateLimitConfig): void {
    const fullConfig: Required<RateLimitConfig> = { ...DEFAULT_LIMIT_CONFIG, ...config }
    const existing = this.buckets.get(operation)
    if (existing) {
      existing.config = fullConfig
      existing.tokens = Math.min(existing.tokens, fullConfig.maxTokens)
    } else {
      this.buckets.set(operation, {
        tokens: fullConfig.allowBurst ? fullConfig.maxTokens : fullConfig.refillRate,
        lastRefill: Date.now(),
        config: fullConfig,
      })
    }
  }

  /** Attempt to consume one token. Throws RateLimitExceeded if denied. */
  consume(operation: OperationType): void {
    this.refill(operation)
    const bucket = this.buckets.get(operation)
    if (!bucket) return // no limit configured → pass through

    if (bucket.tokens <= 0) {
      const waitMs = this.timeUntilNextToken(operation)
      throw new RateLimitExceeded(operation, waitMs)
    }

    bucket.tokens -= 1
  }

  /** Try to consume a token, returns true if consumed, false if rate limited */
  tryConsume(operation: OperationType): boolean {
    try {
      this.consume(operation)
      return true
    } catch {
      return false
    }
  }

  /** Check remaining tokens without consuming */
  remaining(operation: OperationType): number {
    this.refill(operation)
    return this.buckets.get(operation)?.tokens ?? 0
  }

  /** Reset all buckets to full */
  reset(): void {
    for (const [, bucket] of this.buckets) {
      bucket.tokens = bucket.config.maxTokens
      bucket.lastRefill = Date.now()
    }
  }

  /** Reset a specific operation bucket */
  resetOperation(operation: OperationType): void {
    const bucket = this.buckets.get(operation)
    if (bucket) {
      bucket.tokens = bucket.config.maxTokens
      bucket.lastRefill = Date.now()
    }
  }

  // ── Private ──

  private refill(operation: OperationType): void {
    const bucket = this.buckets.get(operation)
    if (!bucket) return

    const now = Date.now()
    const elapsed = now - bucket.lastRefill

    if (elapsed < bucket.config.windowMs) return

    // Calculate tokens to add (at least 1 per window)
    const windows = Math.floor(elapsed / bucket.config.windowMs)
    const toAdd = windows * bucket.config.refillRate

    if (toAdd > 0) {
      bucket.tokens = Math.min(bucket.tokens + toAdd, bucket.config.maxTokens)
      bucket.lastRefill += windows * bucket.config.windowMs
    }
  }

  private timeUntilNextToken(operation: OperationType): number {
    const bucket = this.buckets.get(operation)
    if (!bucket) return 0

    const now = Date.now()
    const elapsed = now - bucket.lastRefill

    if (elapsed >= bucket.config.windowMs) return 0

    return bucket.config.windowMs - elapsed
  }
}
