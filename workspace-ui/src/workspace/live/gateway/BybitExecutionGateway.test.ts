/**
 * BybitExecutionGateway.test.ts — Gateway unit tests
 *
 * Covers connect/disconnect lifecycle, order placement/cancel,
 * position queries, balance queries, RiskContextSource interface,
 * and reconciliation lifecycle.
 *
 * @since Sprint 5.8 Production Launch Gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BybitExecutionGateway } from './BybitExecutionGateway'
import type { RiskPosition } from '../../risk/types'

// ── Mock BybitBrokerAdapter ──

const mockBroker = () => {
  const connection = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
  }
  const orders = {
    getOpenOrders: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn().mockResolvedValue({
      brokerOrderId: 'broker-1',
      symbol: 'BTCUSDT',
      side: 'buy',
      price: 30000,
      quantity: 0.01,
      filledQuantity: 0.01,
      averagePrice: 30010,
      status: 'FILLED',
      type: 'market',
      timeInForce: 'GTC',
      reduceOnly: false,
      clientOrderId: 'ord-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    cancelOrder: vi.fn().mockResolvedValue(true),
    cancelAllOrders: vi.fn().mockResolvedValue(2),
    amendOrder: vi.fn().mockResolvedValue({ brokerOrderId: 'broker-1' } as any),
    getOrder: vi.fn().mockResolvedValue(null),
    getOrderHistory: vi.fn().mockResolvedValue([]),
    replaceOrder: vi.fn().mockResolvedValue({ brokerOrderId: 'broker-1' } as any),
  }
  const positions = {
    getPositions: vi.fn().mockResolvedValue([]),
    getPosition: vi.fn().mockResolvedValue(null),
  }
  const account = {
    getBalances: vi.fn().mockResolvedValue({
      USDT: { free: 5000, locked: 1000, total: 6000 },
      BTC: { free: 0.1, locked: 0, total: 0.1 },
    }),
  }
  return { connection, orders, positions, account }
}

describe('BybitExecutionGateway', () => {
  let broker: ReturnType<typeof mockBroker>
  let gw: BybitExecutionGateway

  beforeEach(() => {
    broker = mockBroker()
    gw = new BybitExecutionGateway(broker as any, false)
  })

  // ── Construction ──

  it('creates with correct id and mode', () => {
    expect(gw.id).toBe('bybit-gateway')
    expect(gw.mode).toBe('live')
    expect(gw.reconciler).toBeDefined()
    expect(gw.recovery).toBeDefined()
  })

  // ── Connect / Disconnect ──

  it('connect calls broker.connect and refreshes state', async () => {
    await gw.connect({
      mode: 'live' as any,
      credentials: { apiKey: 'key', apiSecret: 'secret' },
    })

    expect(broker.connection.connect).toHaveBeenCalledWith('key', 'secret', false)
    expect(broker.orders.getOpenOrders).toHaveBeenCalled()
    expect(broker.positions.getPositions).toHaveBeenCalled()
    expect(broker.account.getBalances).toHaveBeenCalled()
  })

  it('disconnect disconnects broker', async () => {
    await gw.disconnect()
    expect(broker.connection.disconnect).toHaveBeenCalled()
  })

  it('getStatus returns connected when broker is connected', () => {
    const status = gw.getStatus()
    expect(status.connected).toBe(true)
    expect(status.mode).toBe('live')
    expect(status.activeOrders).toBe(0)
    expect(status.openPositions).toBe(0)
  })

  it('getStatus returns disconnected when broker is disconnected', () => {
    broker.connection.isConnected.mockReturnValue(false)
    const status = gw.getStatus()
    expect(status.connected).toBe(false)
  })

  // ── Place Order ──

  it('placeOrder succeeds and returns accepted result', async () => {
    const result = await gw.placeOrder({
      id: 'ord-1', strategyId: 'strat-1', symbol: 'BTCUSDT',
      side: 'buy', type: 'market', quantity: 0.01, timestamp: Date.now(),
    })

    expect(result.accepted).toBe(true)
    expect(result.orderId).toBe('broker-1')
    expect(broker.orders.placeOrder).toHaveBeenCalled()

    // Mock getOpenOrders to return the placed order for verification
    broker.orders.getOpenOrders.mockResolvedValue([{
      brokerOrderId: 'broker-1', symbol: 'BTCUSDT', side: 'buy',
      price: 30000, quantity: 0.01, filledQuantity: 0.01,
      averagePrice: 30010, status: 'FILLED', type: 'market',
      timeInForce: 'GTC', reduceOnly: false,
      clientOrderId: 'ord-1',
      createdAt: Date.now(), updatedAt: Date.now(),
    }])

    const orders = await gw.getOrders()
    expect(orders.length).toBe(1)
    expect(orders[0].id).toBe('ord-1')
  })

  it('placeOrder returns rejected result on broker failure', async () => {
    broker.orders.placeOrder.mockRejectedValue(new Error('insufficient margin'))

    const result = await gw.placeOrder({
      id: 'ord-2', strategyId: 'strat-1', symbol: 'BTCUSDT',
      side: 'sell', type: 'limit', quantity: 0.1, price: 35000, timestamp: Date.now(),
    })

    expect(result.accepted).toBe(false)
    expect(result.message).toContain('insufficient margin')
  })

  it('placeOrder includes fills when partial fill occurs', async () => {
    broker.orders.placeOrder.mockResolvedValue({
      brokerOrderId: 'broker-2', symbol: 'BTCUSDT', side: 'sell',
      price: 30000, quantity: 0.01,
      filledQuantity: 0.005, averagePrice: 29950,
      status: 'PARTIALLY_FILLED', type: 'limit', timeInForce: 'GTC',
      reduceOnly: false, clientOrderId: 'ord-3',
      createdAt: Date.now(), updatedAt: Date.now(),
    })

    const result = await gw.placeOrder({
      id: 'ord-3', strategyId: 'strat-1', symbol: 'BTCUSDT',
      side: 'sell', type: 'limit', quantity: 0.01, price: 30000, timestamp: Date.now(),
    })

    expect(result.accepted).toBe(true)
    expect(result.fills).toBeDefined()
    expect(result.fills!.length).toBe(1)
    expect(result.fills![0].quantity).toBe(0.005)
  })

  // ── Cancel Order ──

  it('cancelOrder by ID clears local order', async () => {
    // Place an order first to populate localOrders
    await gw.placeOrder({
      id: 'ord-1', strategyId: 'strat-1', symbol: 'BTCUSDT',
      side: 'buy', type: 'market', quantity: 0.01, timestamp: Date.now(),
    })

    const ok = await gw.cancelOrder('broker-1')
    expect(ok).toBe(true)
    expect(broker.orders.cancelOrder).toHaveBeenCalledWith('broker-1')

    // Local orders should be cleared
    const orders = await gw.getOrders()
    expect(orders.length).toBe(0)
  })

  it('cancelOrder returns false when broker rejects', async () => {
    broker.orders.cancelOrder.mockResolvedValue(false)
    const ok = await gw.cancelOrder('nonexistent')
    expect(ok).toBe(false)
  })

  it('cancelAllOrders clears all local orders', async () => {
    broker.orders.getOpenOrders.mockResolvedValue([]) // no open orders to re-fetch
    const count = await gw.cancelAllOrders()
    expect(count).toBe(2)
    expect(broker.orders.cancelAllOrders).toHaveBeenCalledWith(undefined)

    const orders = await gw.getOrders()
    expect(orders.length).toBe(0)
  })

  // ── Replace Order (amend) ──

  it('replaceOrder amends and refreshes from broker', async () => {
    broker.orders.getOpenOrders.mockResolvedValue([{
      brokerOrderId: 'broker-1', symbol: 'BTCUSDT', side: 'buy',
      price: 31000, quantity: 0.02, filledQuantity: 0,
      status: 'NEW', type: 'limit', timeInForce: 'GTC',
      reduceOnly: false, clientOrderId: 'ord-1',
      createdAt: Date.now(), updatedAt: Date.now(),
    }])
    broker.orders.getOrder.mockResolvedValue({
      brokerOrderId: 'broker-1', symbol: 'BTCUSDT', side: 'buy',
      price: 31000, quantity: 0.02, filledQuantity: 0,
      status: 'NEW', type: 'limit', timeInForce: 'GTC',
      reduceOnly: false, clientOrderId: 'ord-1',
      createdAt: Date.now(), updatedAt: Date.now(),
    })

    const result = await gw.replaceOrder('broker-1', { price: 31000, quantity: 0.02 })
    expect(result.accepted).toBe(true)
    expect(broker.orders.replaceOrder).toHaveBeenCalledWith('broker-1', { price: 31000, quantity: 0.02 })

    // Local order should be updated
    const orders = await gw.getOrders()
    expect(orders.length).toBe(1)
    expect(orders[0].price).toBe(31000)
  })

  it('replaceOrder returns rejected when replace fails', async () => {
    broker.orders.replaceOrder.mockRejectedValue(new Error('order not found'))
    const result = await gw.replaceOrder('bad-id', { quantity: 0.01 })
    expect(result.accepted).toBe(false)
  })

  // ── Positions ──

  it('refresh() fetches positions and caches them for RiskContextSource', async () => {
    const mockPositions = [
      { symbol: 'BTCUSDT', direction: 'buy' as const, quantity: 0.5,
        averageEntryPrice: 30000, currentPrice: 30000,
        unrealizedPnl: 100, realizedPnl: 0,
        leverage: 1, updatedAt: Date.now() },
    ]
    broker.orders.getOpenOrders.mockResolvedValue([])
    broker.positions.getPositions.mockResolvedValue(mockPositions)
    broker.account.getBalances.mockResolvedValue([])

    await gw.refresh()

    // Check RiskContextSource cache via getPositions(strategyId)
    const riskPositions = await gw.getPositions('strat-1') as Map<string, RiskPosition>
    expect(riskPositions).toBeInstanceOf(Map)
    expect(riskPositions.size).toBe(1)
    expect(riskPositions.get('BTCUSDT')?.symbol).toBe('BTCUSDT')
    expect(riskPositions.get('BTCUSDT')?.direction).toBe('buy')
    expect(riskPositions.get('BTCUSDT')?.quantity).toBe(0.5)
  })

  it('getPosition returns null for unknown symbol', async () => {
    const pos = await gw.getPosition('UNKNOWN')
    expect(pos).toBeNull()
  })

  // ── Balance ──

  it('getBalance returns total equity and per-asset balances', async () => {
    const balance = await gw.getBalance()
    expect(balance.totalEquity).toBe(6000.1) // sum of totals: 6000 USDT + 0.1 BTC
    expect(balance.balances.USDT.free).toBe(5000)
    expect(balance.balances.USDT.locked).toBe(1000)
    expect(balance.mode).toBe('live')
  })

  it('handles empty balances gracefully', async () => {
    broker.account.getBalances.mockResolvedValue({})
    const balance = await gw.getBalance()
    expect(balance.totalEquity).toBe(0)
    expect(Object.keys(balance.balances).length).toBe(0)
  })

  // ── RiskContextSource ──

  it('getPositions returns cached positions', async () => {
    // After a connect, positions should be cached
    broker.positions.getPositions.mockResolvedValue([
      { symbol: 'BTCUSDT', direction: 'buy' as const, quantity: 1,
        averageEntryPrice: 30000, currentPrice: 30000,
        unrealizedPnl: 200, realizedPnl: 0,
        leverage: 2, updatedAt: Date.now() },
    ])

    await gw.connect({
      mode: 'live' as any,
      credentials: { apiKey: 'k', apiSecret: 's' },
    })

    const positions = await gw.getPositions('any-strategy') as Map<string, RiskPosition>
    expect(positions.has('BTCUSDT')).toBe(true)
    expect(positions.get('BTCUSDT')!.quantity).toBe(1)
    expect(positions.get('BTCUSDT')!.leverage).toBe(2)
  })

  it('getAccount returns cached account', () => {
    const acct = gw.getAccount('any-strategy')
    // Initially cachedAccount is zeros
    expect(acct).toBeDefined()
    expect(acct!.currency).toBe('USDT')
  })

  it('getMarket returns cached prices', () => {
    const market = gw.getMarket()
    expect(market).toBeDefined()
    expect(market!.prices).toBeInstanceOf(Map)
  })

  // ── Refresh ──

  it('refresh() refreshes state from exchange', async () => {
    // Simulate changing state after initial connect
    broker.orders.getOpenOrders.mockResolvedValue([{
      brokerOrderId: 'broker-1', symbol: 'BTCUSDT', side: 'buy',
      price: 30000, quantity: 0.01, filledQuantity: 0,
      status: 'NEW', type: 'limit', timeInForce: 'GTC',
      reduceOnly: false, clientOrderId: 'ord-1',
      createdAt: Date.now(), updatedAt: Date.now(),
    }])

    await gw.refresh()
    expect(broker.orders.getOpenOrders).toHaveBeenCalled()
    expect(broker.positions.getPositions).toHaveBeenCalled()
    expect(broker.account.getBalances).toHaveBeenCalled()
  })

  // ── on/off — no-op for legacy events ──

  it('on and off do not throw', () => {
    expect(() => gw.on('event', () => {})).not.toThrow()
    expect(() => gw.off('event', () => {})).not.toThrow()
  })
})
