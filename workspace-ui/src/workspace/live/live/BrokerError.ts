/**
 * BrokerError.ts — Standardized broker error hierarchy
 *
 * Every BrokerAdapter wraps exchange SDK errors into this hierarchy.
 * The rest of the runtime depends ONLY on these error types,
 * never on SDK-specific error classes.
 *
 * @since 4.6
 */

/**
 * Base broker error. All broker errors extend this.
 */
export class BrokerError extends Error {
  /** Machine-readable error code */
  readonly code: string
  /** Original error code from the exchange (if available) */
  readonly exchangeCode?: string
  /** Whether the operation can be safely retried */
  readonly isRetryable: boolean

  constructor(message: string, code: string, exchangeCode?: string, isRetryable = false) {
    super(message)
    this.name = 'BrokerError'
    this.code = code
    this.exchangeCode = exchangeCode
    this.isRetryable = isRetryable
  }
}

// ── Concrete Error Types ──

/**
 * Invalid API key or secret. Inform user to update credentials.
 */
export class AuthenticationError extends BrokerError {
  constructor(message = 'Authentication failed — check API key and secret', exchangeCode?: string) {
    super(message, 'AUTHENTICATION_ERROR', exchangeCode)
    this.name = 'AuthenticationError'
  }
}

/**
 * API key lacks required permissions for the operation.
 */
export class PermissionError extends BrokerError {
  constructor(message = 'API key lacks required permissions', exchangeCode?: string) {
    super(message, 'PERMISSION_ERROR', exchangeCode)
    this.name = 'PermissionError'
  }
}

/**
 * Invalid order parameters (wrong symbol, invalid price, etc.).
 */
export class ValidationError extends BrokerError {
  constructor(message: string, exchangeCode?: string) {
    super(message, 'VALIDATION_ERROR', exchangeCode)
    this.name = 'ValidationError'
  }
}

/**
 * Network-level failure (timeout, connection refused, DNS).
 * Always retryable.
 */
export class NetworkError extends BrokerError {
  constructor(message = 'Network error — connection to exchange failed', exchangeCode?: string) {
    super(message, 'NETWORK_ERROR', exchangeCode, true)
    this.name = 'NetworkError'
  }
}

/**
 * Rate limit exceeded. Back off and retry.
 */
export class RateLimitError extends BrokerError {
  readonly retryAfterMs: number

  constructor(retryAfterMs = 60_000, exchangeCode?: string) {
    super(`Rate limited — retry after ${retryAfterMs}ms`, 'RATE_LIMIT_ERROR', exchangeCode, true)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Exchange rejected the order (insufficient balance, market closed, etc.).
 * Not retryable without user intervention.
 */
export class ExchangeRejectedError extends BrokerError {
  constructor(message: string, exchangeCode?: string) {
    super(message, 'EXCHANGE_REJECTED', exchangeCode)
    this.name = 'ExchangeRejectedError'
  }
}

/**
 * Exchange is temporarily unavailable (maintenance, overload).
 * Retryable with backoff.
 */
export class TemporaryUnavailableError extends BrokerError {
  constructor(message = 'Exchange temporarily unavailable', exchangeCode?: string) {
    super(message, 'TEMPORARY_UNAVAILABLE', exchangeCode, true)
    this.name = 'TemporaryUnavailableError'
  }
}

// ── Error classification helper ──

/** Map an unknown error or SDK error to a BrokerError */
export function classifyBrokerError(err: unknown): BrokerError {
  if (err instanceof BrokerError) return err

  const msg = String(err)
  const lower = msg.toLowerCase()

  // Try to classify by message patterns
  if (lower.includes('auth') || lower.includes('key') || lower.includes('signature') || lower.includes('timestamp')) {
    return new AuthenticationError(msg)
  }
  if (lower.includes('permission') || lower.includes('forbidden') || lower.includes('access')) {
    return new PermissionError(msg)
  }
  if (lower.includes('network') || lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('econnreset')) {
    return new NetworkError(msg)
  }
  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('429')) {
    return new RateLimitError(60_000, msg)
  }
  if (lower.includes('maintenance') || lower.includes('unavailable') || lower.includes('503')) {
    return new TemporaryUnavailableError(msg)
  }
  if (lower.includes('insufficient') || lower.includes('balance') || lower.includes('market') || lower.includes('filter')) {
    return new ExchangeRejectedError(msg)
  }

  return new BrokerError(`Unclassified broker error: ${msg}`, 'UNCLASSIFIED', undefined, false)
}
