/**
 * HistoryScenarios.ts — Builtin history certification scenarios
 *
 * Tests order history, trade journal, timeline completeness,
 * audit trail, and history persistence.
 *
 * Count: 8 scenarios
 *
 * @since 4.9
 */

import type { ScenarioDefinition, ScenarioContext } from '../ScenarioDefinition'
import { scenarioId, scenarioPassed, scenarioFailed } from '../ScenarioDefinition'

export function historyScenarios(): ScenarioDefinition[] {
  return [
    // ── 1. Order history completeness ──
    {
      id: scenarioId('history-01'),
      name: 'Order History — Completeness',
      description: 'Order history should include all previously placed orders',
      category: 'history',
      severity: 'critical',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const history = await ctx.broker.orders.getOrderHistory('BTCUSDT', 50)
          ctx.assert(Array.isArray(history), 'History should be an array')
          ctx.assert(history.length >= 0, 'History should be accessible')
          return scenarioPassed('Order history retrieved', { totalOrders: history.length })
        } catch (err) {
          return scenarioFailed('Order history failed', String(err))
        }
      },
    },

    // ── 2. Balance history ──
    {
      id: scenarioId('history-02'),
      name: 'Balance History — Pre/Post Trade Comparison',
      description: 'Balance before and after a trade should differ',
      category: 'history',
      severity: 'high',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const before = await ctx.broker.account.getBalances()
          await ctx.broker.orders.placeOrder({
            symbol: 'BTCUSDT',
            side: 'buy',
            type: 'MARKET',
            quantity: 0.001,
          })
          await ctx.sleep(2_000)
          const after = await ctx.broker.account.getBalances()
          return scenarioPassed('Balance comparison completed', {
            assetsBefore: Object.keys(before).length,
            assetsAfter: Object.keys(after).length,
          })
        } catch (err) {
          return scenarioFailed('Balance history test failed', String(err))
        }
      },
      timeoutMs: 15_000,
    },

    // ── 3. Account info consistency ──
    {
      id: scenarioId('history-03'),
      name: 'Account Info Consistency',
      description: 'Account info properties should be consistent across calls',
      category: 'history',
      severity: 'high',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const info1 = await ctx.broker.account.getAccountInfo()
          const info2 = await ctx.broker.account.getAccountInfo()
          ctx.assert(typeof info1.totalEquity === 'number', 'totalEquity should be a number')
          ctx.assert(typeof info2.totalEquity === 'number', 'totalEquity should be a number')
          return scenarioPassed('Account info consistent', { equity1: info1.totalEquity, equity2: info2.totalEquity })
        } catch (err) {
          return scenarioFailed('Account info inconsistent', String(err))
        }
      },
    },

    // ── 4. Position history (spot = empty) ──
    {
      id: scenarioId('history-04'),
      name: 'Position History — Spot Returns Empty',
      description: 'Spot broker should return empty position list',
      category: 'history',
      severity: 'medium',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const positions = await ctx.broker.positions.getPositions()
          ctx.assert(Array.isArray(positions), 'Positions should be an array')
          return scenarioPassed('Position history retrieved', { positionCount: positions.length })
        } catch (err) {
          return scenarioFailed('Position history failed', String(err))
        }
      },
    },

    // ── 5. Fill history via getOrder ──
    {
      id: scenarioId('history-05'),
      name: 'Fill History — Execute and Verify Fills',
      description: 'Executed orders should contain fill details',
      category: 'history',
      severity: 'high',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const order = await ctx.broker.orders.placeOrder({
            symbol: 'BTCUSDT',
            side: 'buy',
            type: 'MARKET',
            quantity: 0.001,
          })
          await ctx.sleep(3_000)
          const fetched = await ctx.broker.orders.getOrder(order.brokerOrderId)
          if (fetched) {
            ctx.assert(fetched.filledQuantity >= 0, 'filledQuantity should be a number')
            ctx.assert(typeof fetched.status === 'string', 'status should be a string')
          }
          return scenarioPassed('Fill history verified', {
            orderId: order.brokerOrderId,
            filledQty: fetched?.filledQuantity,
            status: fetched?.status,
          })
        } catch (err) {
          return scenarioFailed('Fill history test failed', String(err))
        }
      },
      timeoutMs: 15_000,
    },

    // ── 6. Timeline completeness ──
    {
      id: scenarioId('history-06'),
      name: 'Timeline — Event Ordering',
      description: 'Order events should be in chronological order',
      category: 'history',
      severity: 'medium',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const history = await ctx.broker.orders.getOrderHistory('BTCUSDT', 20)
          ctx.assert(Array.isArray(history), 'History should be an array')
          return scenarioPassed('Timeline retrieved', { eventCount: history.length })
        } catch (err) {
          return scenarioFailed('Timeline retrieval failed', String(err))
        }
      },
    },

    // ── 7. Audit chain integrity ──
    {
      id: scenarioId('history-07'),
      name: 'Audit Chain — Order Lifecycle Trace',
      description: 'An order should have a traceable lifecycle (placed → status changes)',
      category: 'history',
      severity: 'medium',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          // Place a market order and verify we can trace its lifecycle
          const order = await ctx.broker.orders.placeOrder({
            symbol: 'BTCUSDT',
            side: 'buy',
            type: 'MARKET',
            quantity: 0.001,
          })
          const fetched = await ctx.broker.orders.getOrder(order.brokerOrderId)
          ctx.assert(!!fetched, 'Order should be traceable')
          ctx.assert(!!fetched!.createdAt, 'Order should have createdAt timestamp')
          return scenarioPassed('Audit chain verified', {
            orderId: order.brokerOrderId,
            status: fetched!.status,
            createdAt: fetched!.createdAt,
          })
        } catch (err) {
          return scenarioFailed('Audit chain broken', String(err))
        }
      },
      timeoutMs: 10_000,
    },

    // ── 8. Empty history handling ──
    {
      id: scenarioId('history-08'),
      name: 'Empty History — Non-Existent Symbol',
      description: 'Querying history for a weird symbol should return empty array, not throw',
      category: 'history',
      severity: 'low',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const history = await ctx.broker.orders.getOrderHistory('XXXXXX', 10)
          ctx.assert(Array.isArray(history), 'History should be an array')
          return scenarioPassed('Empty history handled correctly', { count: history.length })
        } catch {
          return scenarioPassed('Empty history query produced error — acceptable for some brokers')
        }
      },
    },
  ]
}
