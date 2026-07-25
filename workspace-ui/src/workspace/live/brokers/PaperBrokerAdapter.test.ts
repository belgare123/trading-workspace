/**
 * PaperBrokerAdapter.test.ts — Paper trading broker unit tests
 *
 * Covers constructor defaults, seedBaseAssets distribution,
 * order/position mapping, connect lifecycle, placeOrder flows,
 * cancel, and balance queries.
 *
 * @system Certification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PaperBrokerAdapter } from './PaperBrokerAdapter'
import type { BrokerPlacementParams } from '../live/types'

// ── Mocks ──

const mockSymbols = {
  has: vi.fn((s: string) => ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(s)),
  add: vi.fn(),
  get: vi.fn(),
  entries: vi.fn().mockReturnValue(
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(s => [s, { symbol: s, base: s.replace('USDT', ''), quote: 'USDT' }])
  ),
}

const mockBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  subscribe: vi.fn(),
  destroy: vi.fn(),
}

const mockFeedRuntime = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  bus: mockBus,
  symbols: mockSymbols as any,
  getOrderBook: vi.fn(),
}

const mockPaper = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  placeOrder: vi.fn().mockResolvedValue({ accepted: true, orderId: 'paper-1-123' }),
  cancelOrder: vi.fn().mockResolvedValue(true),
  replaceOrder: vi.fn().mockResolvedValue({ accepted: true, orderId: 'paper-1-124' }),
  getOrders: vi.fn().mockResolvedValue([]),
  getPositions: vi.fn().mockResolvedValue([]),
  getPosition: vi.fn().mockResolvedValue(null),
  getBalance: vi.fn().mockResolvedValue({ totalEquity: 10000, balances: {} }),
  cashLedger: {
    addBalance: vi.fn(),
    getBalance: vi.fn().mockReturnValue(10000),
    getAll: vi.fn().mockReturnValue({}),
  },
  tradeLedger: {
    all: vi.fn().mockReturnValue([]),
    add: vi.fn(),
  },
  events: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    unsubscribe: vi.fn(),
  },
}

let adapter: PaperBrokerAdapter

describe('PaperBrokerAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Construct adapter with config overrides so symbols+balance are predictable
    adapter = new PaperBrokerAdapter(mockFeedRuntime as any, {
      initialBalance: 10_000,
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    })
    // Replace internal paper with mock
    ;(adapter as any).paper = mockPaper
    ;(adapter as any).connected = false
  })

  // ── Constructor ──

  it('sets defaults when config is omitted', () => {
    const def = new PaperBrokerAdapter(mockFeedRuntime as any)
    expect(def.id).toBe('paper')
    expect(def.name).toBe('Paper Trading')
    expect(def.capabilities.supportsMarket).toBe(true)
    expect(typeof def.connection.connect).toBe('function')
    expect(typeof def.orders.placeOrder).toBe('function')
    expect(typeof def.positions.getPositions).toBe('function')
    expect(typeof def.account.getBalances).toBe('function')
  })

  it('subscribes to paper events', () => {
    expect(mockPaper.events.subscribe).not.toHaveBeenCalled()
  })

  it('creates adapters for connection, orders, positions, account', () => {
    expect(adapter.connection).toBeDefined()
    expect(adapter.orders).toBeDefined()
    expect(adapter.positions).toBeDefined()
    expect(adapter.account).toBeDefined()
  })

  // ── nextOrderId ──

  it('generates sequential order IDs', () => {
    const id1 = (adapter as any).nextOrderId()
    const id2 = (adapter as any).nextOrderId()
    expect(id1).toMatch(/^paper-1-/)
    expect(id2).toMatch(/^paper-2-/)
  })

  // ── seedBaseAssets ──

  it('seedBaseAssets distributes initial balance across symbols', () => {
    const addBalance = mockPaper.cashLedger.addBalance
    adapter.seedBaseAssets()
    // BTC=60000 → 10000/3/60000 ≈ 0.055555
    expect(addBalance).toHaveBeenCalledWith('BTCUSDT', expect.any(Number))
    expect(addBalance).toHaveBeenCalledWith('ETHUSDT', expect.any(Number))
    expect(addBalance).toHaveBeenCalledWith('SOLUSDT', expect.any(Number))
    // Verify BTC quantity: 10000/3/60000 ≈ 0.055556
    const btcQty = addBalance.mock.calls.find((c: any[]) => c[0] === 'BTCUSDT')?.[1]
    expect(btcQty).toBeCloseTo(0.055556, 3)
  })

  it('seedBaseAssets uses price=1 for unknown symbols', () => {
    const custom = new PaperBrokerAdapter(mockFeedRuntime as any, {
      initialBalance: 3000,
      symbols: ['XXXUSDT'],
    })
    ;(custom as any).paper = mockPaper

    const addBalance = mockPaper.cashLedger.addBalance
    custom.seedBaseAssets()
    // 3000/1/1 = 3000
    expect(addBalance).toHaveBeenCalledWith('XXXUSDT', 3000)
  })

  // ── toOrderRequest ──

  it('toOrderRequest maps LIMIT params correctly', () => {
    const params: BrokerPlacementParams = {
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'LIMIT',
      quantity: 0.01,
      price: 30000,
      timeInForce: 'GTC',
    }
    const req = (adapter as any).toOrderRequest(params)
    expect(req.symbol).toBe('BTCUSDT')
    expect(req.side).toBe('buy')
    expect(req.type).toBe('limit')
    expect(req.quantity).toBe(0.01)
    expect(req.price).toBe(30000)
    expect(req.timeInForce).toBe('GTC')
  })

  it('toOrderRequest maps MARKET orders', () => {
    const params: BrokerPlacementParams = {
      symbol: 'ETHUSDT',
      side: 'sell',
      type: 'MARKET',
      quantity: 1,
    }
    const req = (adapter as any).toOrderRequest(params)
    expect(req.type).toBe('market')
    expect(req.side).toBe('sell')
  })

  it('toOrderRequest maps STOP_LOSS_LIMIT to stop_limit', () => {
    const params: BrokerPlacementParams = {
      symbol: 'BTCUSDT',
      side: 'sell',
      type: 'STOP_LOSS_LIMIT',
      quantity: 0.01,
      stopPrice: 29000,
    }
    const req = (adapter as any).toOrderRequest(params)
    expect(req.type).toBe('stop_limit')
    expect(req.stopPrice).toBe(29000)
  })

  it('toOrderRequest maps STOP_LOSS / STOP_MARKET to stop', () => {
    const params: BrokerPlacementParams = {
      symbol: 'BTCUSDT',
      side: 'sell',
      type: 'STOP_LOSS',
      quantity: 0.01,
      stopPrice: 29000,
    }
    const req = (adapter as any).toOrderRequest(params)
    expect(req.type).toBe('stop')
  })

  // ── toBrokerOrder ──

  it('toBrokerOrder maps paper order to BrokerOrder', () => {
    const paperOrder = {
      id: 'paper-1',
      clientId: 'client-1',
      symbol: 'BTCUSDT',
      side: 'buy',
      type: 'limit',
      status: 'filled',
      quantity: 0.01,
      filledQuantity: 0.01,
      price: 30000,
      averagePrice: 30010,
      commission: 0.3,
      timeInForce: 'GTC',
      reduceOnly: false,
      createdAt: 1000,
      updatedAt: 2000,
    }
    const brokerOrder = (adapter as any).toBrokerOrder(paperOrder)
    expect(brokerOrder.brokerOrderId).toBe('paper-1')
    expect(brokerOrder.clientOrderId).toBe('client-1')
    expect(brokerOrder.symbol).toBe('BTCUSDT')
    expect(brokerOrder.status).toBe('FILLED')
    expect(brokerOrder.quantity).toBe(0.01)
    expect(brokerOrder.filledQuantity).toBe(0.01)
  })

  it('toBrokerOrder maps all statuses correctly', () => {
    const base = { id: '1', symbol: 'BTCUSDT', side: 'buy', type: 'limit' }
    const cases = [
      { status: 'accepted', expected: 'NEW' },
      { status: 'pending', expected: 'NEW' },
      { status: 'partially_filled', expected: 'PARTIALLY_FILLED' },
      { status: 'filled', expected: 'FILLED' },
      { status: 'cancelled', expected: 'CANCELLED' },
      { status: 'rejected', expected: 'REJECTED' },
      { status: 'expired', expected: 'EXPIRED' },
    ]
    for (const { status, expected } of cases) {
      const result = (adapter as any).toBrokerOrder({ ...base, status })
      expect(result.status).toBe(expected)
    }
  })

  // ── toBrokerPosition ──

  it('toBrokerPosition maps long position', () => {
    const pos = {
      symbol: 'BTCUSDT',
      direction: 'long',
      quantity: 0.5,
      averageEntryPrice: 30000,
      currentPrice: 31000,
      unrealizedPnl: 500,
      realizedPnl: 100,
    }
    const bp = (adapter as any).toBrokerPosition(pos)
    expect(bp.symbol).toBe('BTCUSDT')
    expect(bp.direction).toBe('long')
    expect(bp.quantity).toBe(0.5)
    expect(bp.averageEntryPrice).toBe(30000)
  })

  it('toBrokerPosition converts flat to long', () => {
    const pos = { symbol: 'BTCUSDT', direction: 'flat', quantity: 0 }
    const bp = (adapter as any).toBrokerPosition(pos)
    expect(bp.direction).toBe('long')
  })

  // ── Connect / Disconnect ──

  it('connect() starts feed, subscribes symbols, connects paper, seeds assets', async () => {
    // When seedBaseAssets is enabled, connect() should call addBalance for each symbol
    adapter = new PaperBrokerAdapter(mockFeedRuntime as any, {
      initialBalance: 10_000,
      symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      seedBaseAssets: true,
    })
    ;(adapter as any).paper = mockPaper
    await adapter.connection.connect()
    expect(mockFeedRuntime.start).toHaveBeenCalled()
    expect(mockFeedRuntime.subscribe).toHaveBeenCalledTimes(3)
    expect(mockPaper.connect).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'paper',
      initialBalance: { USDT: 10000 },
    }))
    expect(mockPaper.cashLedger.addBalance).toHaveBeenCalled()
    expect(adapter.connection.isConnected()).toBe(true)
  })

  it('connect() is idempotent', async () => {
    await adapter.connection.connect()
    mockFeedRuntime.start.mockClear()
    await adapter.connection.connect()
    expect(mockFeedRuntime.start).not.toHaveBeenCalled()
  })

  it('disconnect() disconnects paper and stops feed', async () => {
    await adapter.connection.connect()
    await adapter.connection.disconnect()
    expect(mockPaper.disconnect).toHaveBeenCalled()
    expect(mockFeedRuntime.stop).toHaveBeenCalled()
    expect(adapter.connection.isConnected()).toBe(false)
  })

  // ── Place Order ──

  it('placeOrder throws when not connected', async () => {
    await expect(adapter.orders.placeOrder({ symbol: 'BTCUSDT', side: 'buy', type: 'MARKET', quantity: 0.01 }))
      .rejects.toThrow('Not connected')
  })

  it('placeOrder validates and delegates to paper', async () => {
    await adapter.connection.connect()

    // Mock paper.getOrders to return a placed order
    const paperOrder = {
      id: 'paper-1-123',
      symbol: 'BTCUSDT', side: 'buy', type: 'limit',
      status: 'accepted', quantity: 0.01, price: 30000,
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    mockPaper.getOrders.mockResolvedValue([paperOrder])

    const result = await adapter.orders.placeOrder({
      symbol: 'BTCUSDT', side: 'buy', type: 'LIMIT',
      quantity: 0.01, price: 30000,
    })

    expect(mockPaper.placeOrder).toHaveBeenCalled()
    expect(result.symbol).toBe('BTCUSDT')
    expect(result.status).toBe('NEW')
  })

  it('placeOrder builds minimal order when paper getOrders misses it', async () => {
    await adapter.connection.connect()
    mockPaper.getOrders.mockResolvedValue([])

    const result = await adapter.orders.placeOrder({
      symbol: 'BTCUSDT', side: 'sell', type: 'MARKET', quantity: 0.01,
    })

    expect(result).toBeDefined()
    expect(result.symbol).toBe('BTCUSDT')
    expect(result.status).toBe('NEW')
    expect(result.brokerOrderId).toMatch(/^paper-/)
  })

  it('placeOrder rejects when paper provider rejects', async () => {
    await adapter.connection.connect()
    mockPaper.placeOrder.mockResolvedValue({ accepted: false, message: 'Insufficient balance' })
    await expect(adapter.orders.placeOrder({
      symbol: 'BTCUSDT', side: 'buy', type: 'MARKET', quantity: 100,
    })).rejects.toThrow('Insufficient balance')
  })

  // ── Cancel Order ──

  it('cancelOrder delegates to paper provider', async () => {
    mockPaper.cancelOrder.mockResolvedValue(true)
    const result = await adapter.orders.cancelOrder('paper-1')
    expect(result).toBe(true)
    expect(mockPaper.cancelOrder).toHaveBeenCalledWith('paper-1')
  })

  it('cancelOrder returns false on failure', async () => {
    mockPaper.cancelOrder.mockRejectedValue(new Error('fail'))
    const result = await adapter.orders.cancelOrder('paper-1')
    expect(result).toBe(false)
  })

  // ── Get Orders ──

  it('getOpenOrders filters by status', async () => {
    mockPaper.getOrders.mockResolvedValue([
      { id: 'o1', symbol: 'BTCUSDT', side: 'buy', type: 'limit', status: 'accepted' },
      { id: 'o2', symbol: 'BTCUSDT', side: 'buy', type: 'limit', status: 'filled' },
      { id: 'o3', symbol: 'ETHUSDT', side: 'sell', type: 'limit', status: 'accepted' },
    ])
    const open = await adapter.orders.getOpenOrders()
    expect(open.length).toBe(2) // o1 and o3
  })

  it('getOpenOrders filters by symbol when provided', async () => {
    mockPaper.getOrders.mockResolvedValue([
      { id: 'o1', symbol: 'BTCUSDT', side: 'buy', type: 'limit', status: 'accepted' },
      { id: 'o3', symbol: 'ETHUSDT', side: 'sell', type: 'limit', status: 'accepted' },
    ])
    const btcOpen = await adapter.orders.getOpenOrders('BTCUSDT')
    expect(btcOpen.length).toBe(1)
    expect(btcOpen[0].symbol).toBe('BTCUSDT')
  })

  // ── Positions ──

  it('getPositions delegates to paper and converts', async () => {
    mockPaper.getPositions.mockResolvedValue([
      { symbol: 'BTCUSDT', direction: 'long', quantity: 0.5, averageEntryPrice: 30000,
        currentPrice: 31000, unrealizedPnl: 500, realizedPnl: 0, updatedAt: Date.now() },
    ])
    const positions = await adapter.positions.getPositions()
    expect(positions.length).toBe(1)
    expect(positions[0].direction).toBe('long')
  })

  it('getPosition returns null when not found', async () => {
    mockPaper.getPosition.mockResolvedValue(null)
    const pos = await adapter.positions.getPosition('XXXUSDT')
    expect(pos).toBeNull()
  })

  // ── Balance / Account ──

  it('getBalances returns mapped balances', async () => {
    mockPaper.getBalance.mockResolvedValue({
      totalEquity: 10000,
      balances: { USDT: { free: 5000, locked: 1000 }, BTC: { free: 0.01, locked: 0 } },
    })
    const balances = await adapter.account.getBalances()
    expect(balances['USDT'].free).toBe(5000)
    expect(balances['USDT'].total).toBe(6000)
    expect(balances['BTC'].free).toBe(0.01)
  })

  it('getAccountInfo returns total equity and canTrade flag', async () => {
    mockPaper.getBalance.mockResolvedValue({
      totalEquity: 10000,
      unrealizedPnl: 500,
      balances: {},
    })
    const info = await adapter.account.getAccountInfo()
    expect(info.totalEquity).toBe(10000)
    expect(info.canTrade).toBe(true)
    expect(info.isTestnet).toBe(true)
  })

  // ── Disposal ──

  it('dispose() clears handlers and disconnects', async () => {
    await adapter.dispose()
    expect(mockPaper.disconnect).toHaveBeenCalled()
    expect(adapter.connection.isConnected()).toBe(false)
  })
})
