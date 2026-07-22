// ── Trade Domain: Trade + Order FSM tests ──

import { describe, it, expect } from 'vitest'
import { Trade, type TradeProps } from '../Trade'
import { Order, type OrderProps } from '../Order'
import {
  TradeStatus,
  BrokerOrderStatus,
  Direction,
  OrderSide,
  OrderType,
  TRADE_TRANSITIONS,
  ORDER_TRANSITIONS,
  type Fill,
} from '../types'

// ════════════════════════════════════════
// Helpers
// ════════════════════════════════════════

function makeFill(overrides: Partial<Fill> = {}): Fill {
  const quantity = overrides.quantity ?? 0.5
  const price = overrides.price ?? 60000
  return {
    id: 'fill-1',
    orderId: 'order-1',
    tradeId: 'trade-1',
    symbol: 'BTCUSDT',
    side: OrderSide.Buy,
    price,
    quantity,
    quoteQuantity: price * quantity,
    fee: { asset: 'USDT', amount: price * quantity * 0.001, rate: 0.001, currency: 'USDT' },
    timestamp: Date.now(),
    ...overrides,
    quoteQuantity: overrides.quoteQuantity ?? price * quantity,
  }
}

function makeOrderProps(overrides: Partial<OrderProps> = {}): OrderProps {
  return {
    id: 'order-1',
    tradeId: 'trade-1',
    symbol: 'BTCUSDT',
    side: OrderSide.Buy,
    type: OrderType.Limit,
    quantity: 1.0,
    price: 60000,
    status: BrokerOrderStatus.New,
    fills: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeTradeProps(overrides: Partial<TradeProps> = {}): TradeProps {
  return {
    id: 'trade-1',
    strategyId: 'strategy-1',
    symbol: 'BTCUSDT',
    direction: Direction.Long,
    status: TradeStatus.Created,
    entry: null,
    exits: [],
    orderIds: [],
    fees: [],
    realizedPnL: 0,
    unrealizedPnL: 0,
    metadata: {},
    timestamps: { created: Date.now(), updated: Date.now() },
    ...overrides,
  }
}

/** Create a trade in a baseline Managing state for exit tests */
function tradeInManaging(): Trade {
  const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
  t.setEntryPending('order-1')
  t.addEntryFill(makeFill({ quantity: 2.0 }))
  t.completeEntry()
  t.setManaging()
  return t
}

// ════════════════════════════════════════
// Trade FSM tests
// ════════════════════════════════════════

describe('Trade FSM', () => {
  // ── FSM table completeness ──

  it('every TradeStatus has an entry in TRADE_TRANSITIONS', () => {
    const allStatuses = Object.values(TradeStatus)
    for (const s of allStatuses) {
      expect(TRADE_TRANSITIONS[s]).toBeDefined()
      expect(Array.isArray(TRADE_TRANSITIONS[s])).toBe(true)
    }
  })

  it('terminal states have empty (or self-only) transition arrays', () => {
    expect(TRADE_TRANSITIONS[TradeStatus.Closed]).toEqual([])
    expect(TRADE_TRANSITIONS[TradeStatus.Cancelled]).toEqual([])
    expect(TRADE_TRANSITIONS[TradeStatus.Rejected]).toEqual([])
    // Errored can transition to Cancelled for recovery
    expect(TRADE_TRANSITIONS[TradeStatus.Errored]).toEqual([TradeStatus.Cancelled])
  })

  // ── Trade.create() ──

  it('Trade.create() starts in Created status', () => {
    const t = Trade.create({
      strategyId: 's1',
      symbol: 'BTCUSDT',
      direction: Direction.Long,
    })
    expect(t.status).toBe(TradeStatus.Created)
    expect(t.id).toBeDefined()
    expect(t.strategyId).toBe('s1')
    expect(t.symbol).toBe('BTCUSDT')
    expect(t.direction).toBe(Direction.Long)
    expect(t.isActive).toBe(true)
    expect(t.isTerminal).toBe(false)
  })

  // ── Happy path entry → close ──

  it('follows full happy path: Created → EntryPending → EntryPartial → EntryFilled → Managing → ExitPending → Closed', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    expect(t.status).toBe(TradeStatus.Created)

    t.setEntryPending('order-1')
    expect(t.status).toBe(TradeStatus.EntryPending)
    expect(t.orderIds).toContain('order-1')
    expect(t.timestamps.entrySent).toBeDefined()

    t.addEntryFill(makeFill({ quantity: 1.0 }))
    expect(t.status).toBe(TradeStatus.EntryPartial)
    expect(t.entry).not.toBeNull()
    expect(t.entry!.quantity).toBe(1.0)
    expect(t.entry!.price).toBe(60000)
    expect(t.timestamps.entryFilled).toBeDefined()

    t.completeEntry()
    expect(t.status).toBe(TradeStatus.EntryFilled)

    t.setManaging()
    expect(t.status).toBe(TradeStatus.Managing)
    expect(t.timestamps.managing).toBeDefined()

    t.setExitPending('order-2', 'take-profit')
    expect(t.status).toBe(TradeStatus.ExitPending)
    expect(t.timestamps.exitSent).toBeDefined()

    t.addExitFill(makeFill({ orderId: 'order-2', quantity: 1.0, price: 62000 }), 'take-profit', 2000, 3.33)
    expect(t.status).toBe(TradeStatus.Closed)
    expect(t.isTerminal).toBe(true)
    expect(t.exitedQuantity).toBe(1.0)
    expect(t.realizedPnL).toBe(2000)
    expect(t.timestamps.closed).toBeDefined()
    expect(t.timestamps.exitFilled).toBeDefined()
  })

  // ── Cancellation ──

  it('supports cancel from EntryPending', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    t.setEntryPending('order-1')
    t.cancel()
    expect(t.status).toBe(TradeStatus.Cancelled)
    expect(t.isTerminal).toBe(true)
    expect(t.timestamps.closed).toBeDefined()
  })

  // ── Rejection ──

  it('supports reject from Created', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    t.reject('insufficient balance')
    expect(t.status).toBe(TradeStatus.Rejected)
    expect(t.metadata.rejectReason).toBe('insufficient balance')
  })

  // ── Errored ──

  it('supports markErrored from any state', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    // Force to Managing via manual status change
    const props = t.toSnapshot()
    props.status = TradeStatus.Managing
    const t2 = Trade.fromSnapshot(props)
    t2.markErrored('gateway timeout')
    expect(t2.status).toBe(TradeStatus.Errored)
    expect(t2.metadata.lastError).toBe('gateway timeout')
  })

  // ── Invalid transitions throw ──

  it('throws on invalid transition', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    expect(() => t.transitionTo(TradeStatus.Closed)).toThrow('Trade FSM')
    expect(() => t.transitionTo(TradeStatus.Managing)).toThrow('Trade FSM')
  })

  it('throws setManaging from wrong state', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    expect(() => t.setManaging()).toThrow('Trade FSM')
  })

  it('throws completeEntry from wrong state', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    expect(() => t.completeEntry()).toThrow('Trade FSM')
  })

  // ── Partial entry ──

  it('handles partial entry: Created → EntryPending → EntryPartial → EntryFilled', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    t.setEntryPending('order-1')
    expect(t.status).toBe(TradeStatus.EntryPending)

    t.addEntryFill(makeFill({ quantity: 0.3 }))
    expect(t.status).toBe(TradeStatus.EntryPartial)
    expect(t.entry!.quantity).toBe(0.3)

    t.addEntryFill(makeFill({ quantity: 0.7, price: 60100 }))
    expect(t.status).toBe(TradeStatus.EntryPartial) // still partial until completeEntry
    expect(t.entry!.quantity).toBe(1.0)
    // VWAP = (0.3*60000 + 0.7*60100) / 1.0
    expect(t.entry!.price).toBeCloseTo(60070, 0)

    t.completeEntry()
    expect(t.status).toBe(TradeStatus.EntryFilled)
  })

  // ── Partial exit ──

  it('handles partial exit: Managing → ExitPending → ExitPartial → ExitPending → Closed', () => {
    const t = tradeInManaging()

    // Partial exit 1
    t.setExitPending('order-2', 'partial-exit')
    t.addExitFill(makeFill({ orderId: 'order-2', quantity: 0.5, price: 61000 }), 'partial-exit', 500)
    expect(t.status).toBe(TradeStatus.ExitPartial)
    expect(t.openQuantity).toBe(1.5)

    // Partial exit 2
    t.setExitPending('order-3', 'partial-exit')
    t.addExitFill(makeFill({ orderId: 'order-3', quantity: 1.5, price: 61500 }), 'partial-exit', 2250)
    expect(t.status).toBe(TradeStatus.Closed)
    expect(t.openQuantity).toBe(0)
    expect(t.realizedPnL).toBe(2750)
  })

  // ── Snapshot round-trip ──

  it('snapshot round-trip preserves all fields', () => {
    const t = tradeInManaging()

    const snapshot = t.toSnapshot()
    const restored = Trade.fromSnapshot(snapshot)

    expect(restored.id).toBe(t.id)
    expect(restored.strategyId).toBe(t.strategyId)
    expect(restored.symbol).toBe(t.symbol)
    expect(restored.direction).toBe(t.direction)
    expect(restored.status).toBe(t.status)
    expect(restored.entry!.price).toBe(t.entry!.price)
    expect(restored.entry!.quantity).toBe(t.entry!.quantity)
    expect(restored.orderIds).toEqual(t.orderIds)
    expect(restored.timestamps.created).toBe(t.timestamps.created)
  })

  // ── Unrealized PnL ──

  it('updateUnrealizedPnL stores value and updates timestamp', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    const before = t.timestamps.updated
    t.updateUnrealizedPnL(-150.50)
    expect(t.unrealizedPnL).toBe(-150.50)
    expect(t.timestamps.updated).toBeGreaterThanOrEqual(before)
  })

  // ── VWAP ──

  it('computes correct VWAP after multiple entry fills', () => {
    const t = Trade.create({ strategyId: 's1', symbol: 'BTCUSDT', direction: Direction.Long })
    t.setEntryPending('order-1')
    t.addEntryFill(makeFill({ quantity: 0.3, price: 60000 }))
    t.addEntryFill(makeFill({ quantity: 0.3, price: 60100 }))
    t.addEntryFill(makeFill({ quantity: 0.4, price: 60200 }))
    t.completeEntry()

    expect(t.entry!.quantity).toBe(1.0)
    // VWAP = (0.3*60000 + 0.3*60100 + 0.4*60200) / 1.0
    expect(t.entry!.price).toBeCloseTo(60110, 0)
  })
})

// ════════════════════════════════════════
// Order FSM tests
// ════════════════════════════════════════

describe('Order FSM', () => {
  it('every BrokerOrderStatus has an entry in ORDER_TRANSITIONS', () => {
    const allStatuses = Object.values(BrokerOrderStatus)
    for (const s of allStatuses) {
      expect(ORDER_TRANSITIONS[s]).toBeDefined()
      expect(Array.isArray(ORDER_TRANSITIONS[s])).toBe(true)
    }
  })

  it('terminal states have empty transition arrays', () => {
    expect(ORDER_TRANSITIONS[BrokerOrderStatus.Filled]).toEqual([])
    expect(ORDER_TRANSITIONS[BrokerOrderStatus.Cancelled]).toEqual([])
    expect(ORDER_TRANSITIONS[BrokerOrderStatus.Rejected]).toEqual([])
    expect(ORDER_TRANSITIONS[BrokerOrderStatus.Expired]).toEqual([])
  })

  it('follows happy path: New → Submitted → Accepted → Working → PartialFill → Filled', () => {
    const o = new Order(makeOrderProps())
    expect(o.status).toBe(BrokerOrderStatus.New)

    o.transitionTo(BrokerOrderStatus.Submitted)
    expect(o.status).toBe(BrokerOrderStatus.Submitted)

    o.transitionTo(BrokerOrderStatus.Accepted)
    expect(o.status).toBe(BrokerOrderStatus.Accepted)

    o.transitionTo(BrokerOrderStatus.Working)
    expect(o.status).toBe(BrokerOrderStatus.Working)

    o.addFill(makeFill({ quantity: 0.3 }))
    expect(o.status).toBe(BrokerOrderStatus.PartialFill)
    expect(o.filledQuantity).toBe(0.3)
    expect(o.remainingQuantity).toBe(0.7)

    o.addFill(makeFill({ quantity: 0.7 }))
    expect(o.status).toBe(BrokerOrderStatus.Filled)
    expect(o.filledQuantity).toBe(1.0)
    expect(o.isTerminal).toBe(true)
  })

  it('supports direct fill (no partial): New → Submitted → Accepted → Working → Filled', () => {
    const o = new Order(makeOrderProps())
    o.transitionTo(BrokerOrderStatus.Submitted)
    o.transitionTo(BrokerOrderStatus.Accepted)
    o.transitionTo(BrokerOrderStatus.Working)
    o.addFill(makeFill({ quantity: 1.0 }))
    expect(o.status).toBe(BrokerOrderStatus.Filled)
    expect(o.isTerminal).toBe(true)
  })

  it('supports cancel: Working → Cancelled', () => {
    const o = new Order(makeOrderProps())
    o.transitionTo(BrokerOrderStatus.Submitted)
    o.transitionTo(BrokerOrderStatus.Accepted)
    o.transitionTo(BrokerOrderStatus.Working)
    o.transitionTo(BrokerOrderStatus.Cancelled)
    expect(o.status).toBe(BrokerOrderStatus.Cancelled)
    expect(o.isTerminal).toBe(true)
    expect(o.isActive).toBe(false)
  })

  it('supports reject: New → Rejected', () => {
    const o = new Order(makeOrderProps())
    o.transitionTo(BrokerOrderStatus.Rejected)
    expect(o.status).toBe(BrokerOrderStatus.Rejected)
  })

  it('supports expire: Working → Expired', () => {
    const o = new Order(makeOrderProps())
    o.transitionTo(BrokerOrderStatus.Submitted)
    o.transitionTo(BrokerOrderStatus.Accepted)
    o.transitionTo(BrokerOrderStatus.Working)
    o.transitionTo(BrokerOrderStatus.Expired)
    expect(o.status).toBe(BrokerOrderStatus.Expired)
  })

  it('throws on invalid transition', () => {
    const o = new Order(makeOrderProps({ status: BrokerOrderStatus.New }))
    expect(() => o.transitionTo(BrokerOrderStatus.Filled)).toThrow('Order FSM')
    expect(() => o.transitionTo(BrokerOrderStatus.Working)).toThrow('Order FSM')
  })

  it('throws on transition from terminal state', () => {
    const o = new Order(makeOrderProps())
    o.transitionTo(BrokerOrderStatus.Submitted)
    o.transitionTo(BrokerOrderStatus.Accepted)
    o.transitionTo(BrokerOrderStatus.Working)
    o.addFill(makeFill({ quantity: 1.0 }))
    expect(o.status).toBe(BrokerOrderStatus.Filled)
    expect(() => o.transitionTo(BrokerOrderStatus.Cancelled)).toThrow('Order FSM')
  })

  it('computes averagePrice from fills', () => {
    const o = new Order(makeOrderProps())
    o.transitionTo(BrokerOrderStatus.Submitted)
    o.transitionTo(BrokerOrderStatus.Accepted)
    o.transitionTo(BrokerOrderStatus.Working)
    o.addFill(makeFill({ quantity: 0.3, price: 60000 }))
    o.addFill(makeFill({ quantity: 0.7, price: 60100 }))

    expect(o.averagePrice).toBeCloseTo(60070, 0)
  })

  it('returns undefined averagePrice with no fills', () => {
    const o = new Order(makeOrderProps({ status: BrokerOrderStatus.New }))
    expect(o.averagePrice).toBeUndefined()
  })

  it('snapshot round-trip preserves fields', () => {
    const o = new Order(makeOrderProps())
    o.transitionTo(BrokerOrderStatus.Submitted)
    o.transitionTo(BrokerOrderStatus.Accepted)
    o.transitionTo(BrokerOrderStatus.Working)
    o.addFill(makeFill({ quantity: 0.5 }))

    const snapshot = o.toSnapshot()
    const restored = Order.fromSnapshot(snapshot)

    expect(restored.id).toBe(o.id)
    expect(restored.status).toBe(o.status)
    expect(restored.filledQuantity).toBe(o.filledQuantity)
    expect(restored.averagePrice).toBe(o.averagePrice)
    expect(restored.fills).toHaveLength(o.fills.length)
  })
})
