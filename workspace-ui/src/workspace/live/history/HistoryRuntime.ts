/**
 * HistoryRuntime.ts — History & Audit Runtime facade
 *
 * Coordinates all history subsystems into one unified runtime.
 * Subscribes to ExecutionEventBus and provides a single API for
 * the full 5-level audit trail:
 *
 *   Level 1 — Execution (TradeJournal + OrderHistoryStore)
 *   Level 2 — Strategy (StrategyHistoryStore)
 *   Level 3 — Decision (DecisionLog)
 *   Level 4 — Position (PositionHistoryStore)
 *   Level 5 — Timeline (TimelineBuilder)
 *
 * Usage:
 *   const history = new HistoryRuntime()
 *   history.bindExecutionEventBus(eventBus)
 *   history.recordDecision({ strategyId, signal, conditions, action, ... })
 *   const timeline = history.timeline.getRecent(100)
 *
 * @since 4.4
 */

import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { ExecutionEvent } from '../../execution/events/ExecutionEvents'

import { OrderHistoryStore } from './OrderHistoryStore'
import { PositionHistoryStore } from './PositionHistoryStore'
import { DecisionLog } from './DecisionLog'
import { StrategyHistoryStore } from './StrategyHistoryStore'
import { SessionHistoryStore } from './SessionHistoryStore'
import { TimelineBuilder } from './TimelineBuilder'
import type { TimelineEntry } from './types'

export interface HistoryRuntimeOptions {
  maxOrders?: number
  maxPositions?: number
  maxDecisions?: number
  maxTimeline?: number
  maxSessions?: number
  autoTrim?: boolean
}

export class HistoryRuntime {
  readonly orders: OrderHistoryStore
  readonly positions: PositionHistoryStore
  readonly decisions: DecisionLog
  readonly strategy: StrategyHistoryStore
  readonly sessions: SessionHistoryStore
  readonly timeline: TimelineBuilder

  private unsubscribers: Array<() => void> = []
  private bound = false

  constructor(opts: HistoryRuntimeOptions = {}) {
    this.orders = new OrderHistoryStore(opts.maxOrders ?? 5_000)
    this.positions = new PositionHistoryStore(opts.maxPositions ?? 2_000)
    this.decisions = new DecisionLog(opts.maxDecisions ?? 5_000)
    this.strategy = new StrategyHistoryStore()
    this.sessions = new SessionHistoryStore(opts.maxSessions ?? 200)
    this.timeline = new TimelineBuilder(opts.maxTimeline ?? 10_000)
  }

  // ── Bind to ExecutionEventBus ──

  bindExecutionEventBus(bus: ExecutionEventBus): void {
    if (this.bound) return
    this.bound = true

    // ORDER_ACCEPTED → event.order
    this.subscribeEvent(bus, 'ORDER_ACCEPTED', (event) => {
      const o = event.order
      this.orders.recordOrder(o)
      this.timeline.add({
        timestamp: event.timestamp,
        category: 'order',
        label: 'Order Accepted',
        detail: `${o.side} ${o.quantity} ${o.symbol} @ ${o.price ?? 'MKT'}`,
        refId: o.id,
        symbol: o.symbol,
        strategyId: o.strategyId,
      })
    })

    // ORDER_FILLED → event.order + event.fill
    this.subscribeEvent(bus, 'ORDER_FILLED', (event) => {
      const { order, fill } = event
      this.orders.recordFill(order, fill)
      this.timeline.add({
        timestamp: event.timestamp,
        category: 'fill',
        label: 'Order Filled',
        detail: `${fill.quantity} ${order.symbol} @ ${fill.price} (comm: ${fill.commission})`,
        refId: order.id,
        symbol: order.symbol,
        strategyId: order.strategyId,
      })
    })

    // ORDER_CANCELLED → event.order
    this.subscribeEvent(bus, 'ORDER_CANCELLED', (event) => {
      const o = event.order
      this.orders.updateStatus(o)
      this.timeline.add({
        timestamp: event.timestamp,
        category: 'order',
        label: 'Order Cancelled',
        detail: `${o.side} ${o.quantity} ${o.symbol}`,
        refId: o.id,
        symbol: o.symbol,
        strategyId: o.strategyId,
      })
    })

    // POSITION_OPENED → event.position
    this.subscribeEvent(bus, 'POSITION_OPENED', (event) => {
      const p = event.position
      this.positions.open(
        p.symbol,
        'live', // strategyId not on Position type at execution layer
        p.direction as 'long' | 'short',
        p.averageEntryPrice,
        p.quantity,
        event.timestamp,
      )
      this.timeline.add({
        timestamp: event.timestamp,
        category: 'position',
        label: 'Position Opened',
        detail: `${p.direction} ${p.quantity} ${p.symbol} @ ${p.averageEntryPrice}`,
        symbol: p.symbol,
      })
    })

    // POSITION_CLOSED → event.position + event.realizedPnl
    this.subscribeEvent(bus, 'POSITION_CLOSED', (event) => {
      const { position: p, realizedPnl } = event
      this.positions.close(
        p.symbol,
        'live',
        p.averageEntryPrice,
        realizedPnl,
        event.timestamp,
      )
      this.timeline.add({
        timestamp: event.timestamp,
        category: 'position',
        label: 'Position Closed',
        detail: `${p.symbol} — PnL: ${realizedPnl != null ? realizedPnl.toFixed(2) : '?'}`,
        symbol: p.symbol,
      })
    })

    // TRADE_RECORDED → event.trade
    this.subscribeEvent(bus, 'TRADE_RECORDED', (event) => {
      const t = event.trade
      this.timeline.add({
        timestamp: event.timestamp,
        category: 'journal',
        label: 'Trade Recorded',
        detail: `${t.symbol} ${t.side}`,
        symbol: t.symbol,
      })
    })

    // EQUITY_CHANGED → event.equity
    this.subscribeEvent(bus, 'EQUITY_CHANGED', (event) => {
      this.sessions.updateEquity(event.equity.totalEquity)
    })
  }

  // ── Decision recording (from Strategy Runtime) ──

  recordDecision(params: Parameters<DecisionLog['buildDecision']>[0]): ReturnType<DecisionLog['buildDecision']> {
    const decision = this.decisions.buildDecision(params)
    this.sessions.recordDecision()

    this.timeline.add({
      timestamp: decision.timestamp,
      category: 'decision',
      label: `Decision: ${decision.action.name}`,
      detail: decision.action.reason,
      refId: decision.id,
      symbol: params.symbol,
      strategyId: params.strategyId,
    })

    return decision
  }

  // ── Strategy lifecycle ──

  recordStrategyStart(strategyId: string, message?: string): void {
    this.strategy.recordStarted(strategyId, message)
    this.sessions.beginSession(strategyId)
    this.timeline.event('decision', 'Strategy Started', message ?? `Strategy ${strategyId} started`, strategyId, undefined, strategyId)
  }

  recordStrategyStop(strategyId: string, message?: string): void {
    this.strategy.recordStopped(strategyId, message)
    this.sessions.endSession()
    this.timeline.event('decision', 'Strategy Stopped', message ?? `Strategy ${strategyId} stopped`, strategyId, undefined, strategyId)
  }

  // ── Timeline helpers ──

  marketEvent(symbol: string, label: string, detail: string): TimelineEntry {
    return this.timeline.event('market', label, detail, undefined, symbol)
  }

  signalEvent(strategyId: string, signalName: string, value: number, symbol?: string): TimelineEntry {
    this.sessions.recordSignal()
    return this.timeline.add({
      timestamp: Date.now(),
      category: 'signal',
      label: `Signal: ${signalName}`,
      detail: `${signalName} = ${value.toFixed(4)}`,
      symbol,
      strategyId,
    })
  }

  errorEvent(error: string, strategyId?: string): TimelineEntry {
    this.strategy.recordError(strategyId ?? 'unknown', error)
    return this.timeline.event('error', 'Runtime Error', error, undefined, undefined, strategyId)
  }

  // ── Queries ──

  /** Build a complete timeline for a strategy */
  getStrategyTimeline(strategyId: string): TimelineEntry[] {
    return this.timeline.getByStrategy(strategyId)
  }

  /** Build a complete history for a symbol */
  getSymbolHistory(symbol: string): {
    orders: ReturnType<OrderHistoryStore['getBySymbol']>
    positions: ReturnType<PositionHistoryStore['getBySymbol']>
    decisions: ReturnType<DecisionLog['getDecisionsBySymbol']>
    timeline: TimelineEntry[]
  } {
    return {
      orders: this.orders.getBySymbol(symbol),
      positions: this.positions.getBySymbol(symbol),
      decisions: this.decisions.getDecisionsBySymbol(symbol),
      timeline: this.timeline.getBySymbol(symbol),
    }
  }

  // ── Lifecycle ──

  unbind(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
    this.bound = false
  }

  clear(): void {
    this.unbind()
    this.orders.clear()
    this.positions.clear()
    this.decisions.clear()
    this.strategy.clear()
    this.sessions.clear()
    this.timeline.clear()
  }

  private subscribeEvent<K extends ExecutionEvent['type']>(
    bus: ExecutionEventBus,
    type: K,
    handler: (event: Extract<ExecutionEvent, { type: K }>) => void,
  ): void {
    const unsub = bus.on(type, handler)
    if (typeof unsub === 'function') {
      this.unsubscribers.push(unsub)
    }
  }
}
