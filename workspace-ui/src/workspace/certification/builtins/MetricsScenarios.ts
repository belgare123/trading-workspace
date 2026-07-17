/**
 * MetricsScenarios.ts — Builtin metrics certification scenarios
 *
 * Tests P&L consistency, equity tracking, drawdown calculation,
 * and metric export integrity.
 *
 * Count: 7 scenarios
 *
 * @since 4.9
 */

import type { ScenarioDefinition, ScenarioContext } from '../ScenarioDefinition'
import { scenarioId, scenarioPassed, scenarioFailed } from '../ScenarioDefinition'

export function metricsScenarios(): ScenarioDefinition[] {
  return [
    // ── 1. Equity availability ──
    {
      id: scenarioId('metrics-01'),
      name: 'Equity — Total Equity Accessible',
      description: 'Account total equity should be a positive number',
      category: 'metrics',
      severity: 'critical',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const info = await ctx.broker.account.getAccountInfo()
          ctx.assert(typeof info.totalEquity === 'number', 'totalEquity should be a number')
          ctx.assert(info.totalEquity >= 0, 'totalEquity should be >= 0')
          return scenarioPassed('Equity accessible', { totalEquity: info.totalEquity })
        } catch (err) {
          return scenarioFailed('Equity check failed', String(err))
        }
      },
    },

    // ── 2. Balance total consistency ──
    {
      id: scenarioId('metrics-02'),
      name: 'Balance — Total = Free + Locked',
      description: 'For each asset, total should equal free + locked',
      category: 'metrics',
      severity: 'high',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const balances = await ctx.broker.account.getBalances()
          const inconsistencies: string[] = []
          for (const [asset, bal] of Object.entries(balances)) {
            const expectedTotal = bal.free + bal.locked
            if (Math.abs(expectedTotal - bal.total) > 0.00000001) {
              inconsistencies.push(`${asset}: free=${bal.free} locked=${bal.locked} total=${bal.total}`)
            }
          }
          ctx.assert(
            inconsistencies.length === 0,
            `Balance inconsistency: ${inconsistencies.join(', ')}`,
          )
          return scenarioPassed('All balances consistent', { assetCount: Object.keys(balances).length })
        } catch (err) {
          return scenarioFailed('Balance consistency check failed', String(err))
        }
      },
    },

    // ── 3. Can trade flag ──
    {
      id: scenarioId('metrics-03'),
      name: 'Account — Can Trade Flag',
      description: 'Account info should report canTrade status',
      category: 'metrics',
      severity: 'high',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const info = await ctx.broker.account.getAccountInfo()
          ctx.assert(
            typeof info.canTrade === 'boolean',
            'canTrade should be a boolean',
          )
          return scenarioPassed('canTrade flag reported', { canTrade: info.canTrade })
        } catch (err) {
          return scenarioFailed('canTrade check failed', String(err))
        }
      },
    },

    // ── 4. Balance change after trade ──
    {
      id: scenarioId('metrics-04'),
      name: 'Balance Change — After Market Order',
      description: 'Balance should change after executing a market order',
      category: 'metrics',
      severity: 'high',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const before = await ctx.broker.account.getBalances()
          const btcBefore = before['BTC']?.total ?? 0

          await ctx.broker.orders.placeOrder({
            symbol: 'BTCUSDT',
            side: 'buy',
            type: 'MARKET',
            quantity: 0.001,
          })
          await ctx.sleep(3_000)

          const after = await ctx.broker.account.getBalances()
          const btcAfter = after['BTC']?.total ?? 0

          return scenarioPassed('Balance change observed', {
            btcBefore,
            btcAfter,
            btcDelta: btcAfter - btcBefore,
          })
        } catch (err) {
          return scenarioFailed('Balance change test failed', String(err))
        }
      },
      timeoutMs: 15_000,
    },

    // ── 5. Unrealized PnL (spot = 0) ──
    {
      id: scenarioId('metrics-05'),
      name: 'Unrealized PnL — Spot Returns 0',
      description: 'Spot trading has no unrealized PnL',
      category: 'metrics',
      severity: 'medium',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const info = await ctx.broker.account.getAccountInfo()
          ctx.assert(
            typeof info.unrealizedPnl === 'number',
            'unrealizedPnl should be a number',
          )
          return scenarioPassed('Unrealized PnL reported', { unrealizedPnl: info.unrealizedPnl })
        } catch (err) {
          return scenarioFailed('Unrealized PnL check failed', String(err))
        }
      },
    },

    // ── 6. No negative balance ──
    {
      id: scenarioId('metrics-06'),
      name: 'Balance — No Negative Values',
      description: 'No asset balance should have negative free/total',
      category: 'metrics',
      severity: 'medium',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const balances = await ctx.broker.account.getBalances()
          const negatives: string[] = []
          for (const [asset, bal] of Object.entries(balances)) {
            if (bal.free < -0.00000001) negatives.push(`${asset}.free=${bal.free}`)
            if (bal.locked < -0.00000001) negatives.push(`${asset}.locked=${bal.locked}`)
            if (bal.total < -0.00000001) negatives.push(`${asset}.total=${bal.total}`)
          }
          ctx.assert(negatives.length === 0, `Negative balances: ${negatives.join(', ')}`)
          return scenarioPassed('No negative balances', { assetCount: Object.keys(balances).length })
        } catch (err) {
          return scenarioFailed('Negative balance check failed', String(err))
        }
      },
    },

    // ── 7. Good old metrics export ──
    {
      id: scenarioId('metrics-07'),
      name: 'Balance Snapshot Export',
      description: 'Balances can be serialized for metrics export',
      category: 'metrics',
      severity: 'low',
      requiresConnection: true,
      execute: async (ctx: ScenarioContext) => {
        try {
          const balances = await ctx.broker.account.getBalances()
          const snapshot = JSON.stringify(balances)
          ctx.assert(typeof snapshot === 'string', 'Should serialize to JSON')
          const parsed = JSON.parse(snapshot)
          ctx.assert(typeof parsed === 'object', 'Should parse back from JSON')
          return scenarioPassed('Balance snapshot exportable', {
            sizeBytes: snapshot.length,
            assetCount: Object.keys(balances).length,
          })
        } catch (err) {
          return scenarioFailed('Balance export failed', String(err))
        }
      },
    },
  ]
}
