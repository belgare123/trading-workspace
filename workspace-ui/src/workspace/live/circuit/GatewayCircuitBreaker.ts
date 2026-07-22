/**
 * GatewayCircuitBreaker.ts — Circuit breaker integration for ExecutionGateway
 *
 * Wraps an ExecutionGateway with circuit breaker protection.
 * Write operations (placeOrder, cancelOrder, replaceOrder, connect)
 * are protected — open circuit blocks them with a fast rejection.
 * Read operations (getOrders, getPositions, getBalance) pass through
 * regardless of circuit state.
 *
 * Error classification maps gateway errors to circuit breaker categories:
 *   - broker errors → 'exchange'
 *   - rate-limit / 429 → 'rate_limit'
 *   - timeout / ETIMEDOUT → 'timeout'
 *   - auth / 401 / 403 → 'auth'
 *   - dns / ENOTFOUND / ECONNREFUSED → 'dns'
 *   - ws disconnect → 'ws_disconnect'
 *   - 5xx / internal error → 'http_5xx'
 *   - network / connection → 'network'
 *   - default → 'exchange'
 *
 * Usage:
 *   const gateway = new BybitExecutionGateway(broker)
 *   const cbGateway = new GatewayCircuitBreaker(gateway)
 *   // All write operations go through circuit breaker
 *   await cbGateway.placeOrder(order) // blocks if circuit open
 *
 * Connect DegradationManager:
 *   const dm = new DegradationManager(cbGateway.circuitBreaker, lifecycle)
 *
 * @since 6.2
 */

import type { ExecutionGateway, GatewayConfig, GatewayStatus, OrderResult, AccountInfo } from '../gateway/ExecutionGateway'
import type { OrderRequest, Order, Position } from '../../execution/types'
import { CircuitBreaker } from './CircuitBreaker'
import type { CircuitBreakerConfig, ErrorCategory } from './CircuitBreaker'

// ── Error Classification ──

const RATE_LIMIT_PATTERNS = /rate.?limit|429|too many requests/i
const TIMEOUT_PATTERNS = /timeout|etimedout|econnaborted|socket hang up/i
const AUTH_PATTERNS = /auth|401|403|unauthorized|invalid.*(api|key|secret)|signature/i
const DNS_PATTERNS = /enotfound|econnrefused|eai_again|dns|network is unreachable/i
const WS_PATTERNS = /websocket|ws.*disconnect|ws.*close|connection.*(close|reset)/i
const HTTP_5XX_PATTERNS = /5\d{2}|internal server error|service unavailable|bad gateway/i

function classifyError(err: Error): ErrorCategory {
  const msg = `${err.name} ${err.message}`
  if (RATE_LIMIT_PATTERNS.test(msg)) return 'rate_limit'
  if (TIMEOUT_PATTERNS.test(msg)) return 'timeout'
  if (AUTH_PATTERNS.test(msg)) return 'auth'
  if (DNS_PATTERNS.test(msg)) return 'dns'
  if (WS_PATTERNS.test(msg)) return 'ws_disconnect'
  if (HTTP_5XX_PATTERNS.test(msg)) return 'http_5xx'
  const lower = err.name.toLowerCase()
  if (lower.includes('network') || lower.includes('connection')) return 'network'
  return 'exchange'
}

// ── Gateway Wrapper ──

export class GatewayCircuitBreaker<G extends ExecutionGateway = ExecutionGateway> {
  /** The underlying gateway instance */
  readonly delegate: G
  /** The circuit breaker protecting write operations */
  readonly circuitBreaker: CircuitBreaker

  constructor(
    delegate: G,
    config?: Partial<CircuitBreakerConfig>,
  ) {
    this.delegate = delegate
    this.circuitBreaker = new CircuitBreaker({
      name: `${delegate.id}-cb`,
      failureThreshold: config?.failureThreshold ?? 5,
      failureWindowMs: config?.failureWindowMs ?? 60_000,
      cooldownMs: config?.cooldownMs ?? 30_000,
      recoveryTimeoutMs: config?.recoveryTimeoutMs ?? 60_000,
      degradedAfterN: config?.degradedAfterN ?? 3,
      halfOpenMaxRequests: config?.halfOpenMaxRequests ?? 1,
      immediateOnAuthError: config?.immediateOnAuthError ?? true,
      immediateOnNetworkError: config?.immediateOnNetworkError ?? true,
    })
  }

  /** Name of this protected gateway */
  get name(): string {
    return this.circuitBreaker.snapshot().name
  }

  /** Check if a write operation is allowed (fast fail before calling delegate) */
  checkAllowed(): void {
    if (!this.circuitBreaker.tryRequest()) {
      const s = this.circuitBreaker.snapshot()
      throw new Error(
        `[${s.name}] Circuit ${s.state} — request blocked`,
      )
    }
  }

  /** Record operation result (success or failure) */
  recordResult(err: unknown): void {
    if (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      this.circuitBreaker.recordFailure(e, classifyError(e))
    } else {
      this.circuitBreaker.recordSuccess()
    }
  }

  /** Snapshot for monitoring */
  snapshot() {
    return this.circuitBreaker.snapshot()
  }

  // ── Delegated: protected write operations ──

  /** Place order with circuit breaker protection */
  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    this.checkAllowed()
    try {
      const result = await this.delegate.placeOrder(request)
      if (!result.accepted) {
        this.recordResult(new Error(`Order rejected: ${result.message}`))
      } else {
        this.recordResult(null)
      }
      return result
    } catch (err) {
      this.recordResult(err)
      throw err
    }
  }

  /** Cancel order with circuit breaker protection */
  async cancelOrder(orderId: string): Promise<boolean> {
    this.checkAllowed()
    try {
      const result = await this.delegate.cancelOrder(orderId)
      this.recordResult(null)
      return result
    } catch (err) {
      this.recordResult(err)
      throw err
    }
  }

  /** Cancel all orders with circuit breaker protection */
  async cancelAllOrders(symbol?: string): Promise<number> {
    this.checkAllowed()
    try {
      const result = await this.delegate.cancelAllOrders(symbol)
      this.recordResult(null)
      return result
    } catch (err) {
      this.recordResult(err)
      throw err
    }
  }

  /** Replace order with circuit breaker protection */
  async replaceOrder(orderId: string, request: Partial<OrderRequest>): Promise<OrderResult> {
    this.checkAllowed()
    try {
      const result = await this.delegate.replaceOrder(orderId, request)
      if (!result.accepted) {
        this.recordResult(new Error(`Replace rejected: ${result.message}`))
      } else {
        this.recordResult(null)
      }
      return result
    } catch (err) {
      this.recordResult(err)
      throw err
    }
  }

  /** Connect gateway (protected — network errors may trip circuit) */
  async connect(config: GatewayConfig): Promise<void> {
    try {
      await this.delegate.connect(config)
      this.recordResult(null)
    } catch (err) {
      this.recordResult(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }

  // ── Pass-through (read operations not blocked) ──

  async disconnect(): Promise<void> {
    await this.delegate.disconnect()
  }

  getStatus(): GatewayStatus {
    const status = this.delegate.getStatus()
    const s = this.circuitBreaker.snapshot()
    if (s.state !== 'CLOSED') {
      return { ...status, error: `Circuit ${s.state}: ${s.lastError ?? 'blocked'}` }
    }
    return status
  }

  async getOrders(filter?: { symbol?: string; status?: string; limit?: number }): Promise<Order[]> {
    return this.delegate.getOrders(filter)
  }

  async getPositions(): Promise<Position[]> {
    return this.delegate.getPositions()
  }

  async getPosition(symbol: string): Promise<Position | null> {
    return this.delegate.getPosition(symbol)
  }

  async getBalance(): Promise<AccountInfo> {
    return this.delegate.getBalance()
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    this.delegate.on(event, listener)
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.delegate.off(event, listener)
  }
}
