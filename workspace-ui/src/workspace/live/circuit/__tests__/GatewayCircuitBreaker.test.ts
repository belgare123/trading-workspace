/**
 * GatewayCircuitBreaker.test.ts — tests for GatewayCircuitBreaker wrapper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GatewayCircuitBreaker } from '../GatewayCircuitBreaker'
import type { ExecutionGateway, GatewayConfig, GatewayStatus, OrderResult, AccountInfo } from '../../gateway/ExecutionGateway'
import type { OrderRequest, Order, Position } from '../../../execution/types'

// ── Mock Gateway ──

class MockGateway implements ExecutionGateway {
  readonly id = 'mock-gateway'
  readonly mode = Symbol('mock') as unknown as import('../../gateway/ExecutionMode').ExecutionMode

  private _connected = false
  connectCallCount = 0

  async connect(_config: GatewayConfig): Promise<void> {
    this.connectCallCount++
    this._connected = true
  }

  async disconnect(): Promise<void> {
    this._connected = false
  }

  getStatus(): GatewayStatus {
    return {
      connected: this._connected,
      mode: this.mode,
      uptime: 0,
      activeOrders: 0,
      openPositions: 0,
    }
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    return { accepted: true, orderId: `order-${request.id}` }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    return true
  }

  async cancelAllOrders(_symbol?: string): Promise<number> {
    return 0
  }

  async replaceOrder(orderId: string, _request: Partial<OrderRequest>): Promise<OrderResult> {
    return { accepted: true, orderId: `replaced-${orderId}` }
  }

  async getOrders(_filter?: { symbol?: string; status?: string; limit?: number }): Promise<Order[]> {
    return []
  }

  async getPositions(): Promise<Position[]> {
    return []
  }

  async getPosition(_symbol: string): Promise<Position | null> {
    return null
  }

  async getBalance(): Promise<AccountInfo> {
    return {
      totalEquity: 10000,
      balances: { USDT: { free: 10000, locked: 0 } },
      unrealizedPnl: 0,
      realizedPnl: 0,
      mode: this.mode,
    }
  }

  on(_event: string, _listener: (...args: unknown[]) => void): void {}
  off(_event: string, _listener: (...args: unknown[]) => void): void {}
}

// ── Mock Error Gateway ──

class ErrorGateway extends MockGateway {
  readonly id = 'error-gateway'
  readonly mode = Symbol('error') as unknown as import('../../gateway/ExecutionMode').ExecutionMode

  async placeOrder(): Promise<OrderResult> {
    throw new Error('Rate limit exceeded — 429 Too Many Requests')
  }

  async cancelOrder(): Promise<boolean> {
    throw new Error('ECONNRESET: connection reset')
  }

  async connect(_config: GatewayConfig): Promise<void> {
    throw new Error('ENOTFOUND: api.bybit.com')
  }
}

describe('GatewayCircuitBreaker', () => {
  let mock: MockGateway
  let cb: GatewayCircuitBreaker<MockGateway>

  beforeEach(() => {
    mock = new MockGateway()
    cb = new GatewayCircuitBreaker(mock, {
      failureThreshold: 3,
      immediateOnNetworkError: false, // disable for predictable thresholds
    })
  })

  // ── Circuit State ──

  it('starts in CLOSED state', () => {
    expect(cb.snapshot().state).toBe('CLOSED')
  })

  it('exposes delegate via .delegate', () => {
    expect(cb.delegate).toBe(mock)
  })

  // ── Protected write operations ──

  it('allows placeOrder when circuit is CLOSED', async () => {
    const result = await cb.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest)
    expect(result.accepted).toBe(true)
    expect(result.orderId).toBe('order-1')
  })

  it('blocks placeOrder when circuit is OPEN', async () => {
    // Trip the circuit
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    // First call fails and opens circuit
    await expect(cb2.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow('429')

    // Second call should be blocked
    await expect(cb2.placeOrder({ id: '2', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow('Circuit OPEN')
  })

  it('tracks failure count on errors', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 5, immediateOnNetworkError: false })

    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      await expect(cb2.placeOrder({ id: `${i}`, symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
        .rejects.toThrow()
    }

    expect(cb2.snapshot().failures.total).toBe(3)
    expect(cb2.snapshot().state).toBe('CLOSED') // 3 < 5 threshold
  })

  it('opens circuit after threshold exceeded', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 3, immediateOnNetworkError: false })

    for (let i = 0; i < 3; i++) {
      await expect(cb2.placeOrder({ id: `${i}`, symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
        .rejects.toThrow()
    }

    expect(cb2.snapshot().state).toBe('OPEN')
  })

  it('classifies rate limit errors correctly', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    await expect(cb2.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow()

    expect(cb2.snapshot().failures.byCategory.rate_limit).toBe(1)
  })

  it('classifies connection errors correctly', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    await expect(cb2.cancelOrder('x')).rejects.toThrow()

    // ECONNRESET → connection.*reset → ws_disconnect pattern
    expect(cb2.snapshot().failures.byCategory.ws_disconnect).toBe(1)
  })

  it('classifies DNS errors on connect', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    await expect(cb2.connect({ mode: errorGateway.mode })).rejects.toThrow()

    expect(cb2.snapshot().failures.byCategory.dns).toBe(1)
  })

  it('cancelAllOrders is protected by circuit', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    // Trip with cancelOrder
    await expect(cb2.cancelOrder('x')).rejects.toThrow()

    // cancelAllOrders should be blocked
    await expect(cb2.cancelAllOrders()).rejects.toThrow('Circuit OPEN')
  })

  it('replaceOrder is protected by circuit', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    // Trip
    await expect(cb2.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow()

    await expect(cb2.replaceOrder('x', { quantity: 5 })).rejects.toThrow('Circuit OPEN')
  })

  // ── Read operations pass through ──

  it('getOrders passes through when circuit is OPEN', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    // Trip circuit
    await expect(cb2.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow()

    // Read ops still work
    const orders = await cb2.getOrders()
    expect(orders).toEqual([])
  })

  it('getPositions passes through when circuit is OPEN', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    await expect(cb2.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow()

    const positions = await cb2.getPositions()
    expect(positions).toEqual([])
  })

  it('getBalance passes through when circuit is OPEN', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    await expect(cb2.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow()

    const balance = await cb2.getBalance()
    expect(balance.totalEquity).toBe(10000)
  })

  it('getStatus includes circuit state when OPEN', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    await expect(cb2.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest))
      .rejects.toThrow()

    const status = cb2.getStatus()
    expect(status.error).toContain('Circuit OPEN')
  })

  // ── Success recording ──

  it('records success on successful placeOrder', async () => {
    await cb.placeOrder({ id: '1', symbol: 'XRPUSDT', side: 'buy', quantity: 10 } as OrderRequest)

    expect(cb.snapshot().failures.total).toBe(0)
    expect(cb.snapshot().state).toBe('CLOSED')
  })

  it('disconnect does not record failure', async () => {
    const errorGateway = new ErrorGateway()
    const cb2 = new GatewayCircuitBreaker(errorGateway, { failureThreshold: 1, immediateOnNetworkError: false })

    // Intentionally disconnect — should NOT record as failure
    await cb2.disconnect()
    expect(cb2.snapshot().failures.total).toBe(0)
  })

  // ── Event passthrough ──

  it('forwards on/off to delegate', () => {
    const spy = vi.spyOn(mock, 'on')
    const listener = () => {}
    cb.on('order:placed', listener)
    expect(spy).toHaveBeenCalledWith('order:placed', listener)
  })
})
