// ── StartupRecoveryRuntime tests ──

import { describe, it, expect, vi } from 'vitest'
import { StartupRecoveryRuntime } from '../StartupRecoveryRuntime'
import type { StartupRecoveryDeps } from '../StartupRecoveryRuntime'

/** Factory for a connected gateway with configurable state */
function makeDeps(overrides?: Partial<StartupRecoveryDeps>): StartupRecoveryDeps {
  return {
    gateway: {
      isConnected: () => true,
      getPositions: async () => [],
      getOrders: async () => [],
      getBalance: async () => ({ totalEquity: 10000, freeBalance: 8000, usedMargin: 2000, unrealizedPnl: 0, realizedPnl: 0, dailyPnl: 0, dailyTrades: 0, currency: 'USDT' }),
    } as any,
    risk: {
      resetDailyCounters: () => {},
      stats: { totalRules: 5, activeRules: 3, violationCount: 0 },
    } as any,
    recoverTrades: async () => ({ recovered: 0, warnings: [], errors: [] }),
    syncHistory: async () => ({ warnings: [], errors: [] }),
    ...overrides,
  }
}

describe('StartupRecoveryRuntime', () => {
  it('returns healthy report when all syncs succeed', async () => {
    const sr = new StartupRecoveryRuntime(makeDeps())
    const report = await sr.recover()
    expect(report.healthy).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('returns unhealthy report when gateway is not connected', async () => {
    const sr = new StartupRecoveryRuntime(makeDeps({
      gateway: { isConnected: () => false } as any,
    }))
    const report = await sr.recover()
    expect(report.healthy).toBe(false)
    expect(report.errors.length).toBeGreaterThan(0)
    expect(report.errors[0]).toContain('not connected')
  })

  it('detects recovered positions from gateway and calls recoverTrades', async () => {
    const recoverTradesSpy = vi.fn(async () => ({ recovered: 2, warnings: [], errors: [] }))
    const sr = new StartupRecoveryRuntime(makeDeps({
      gateway: {
        isConnected: () => true,
        getPositions: async () => [
          { symbol: 'BTCUSDT', size: 0.5, entryPrice: 60000 },
          { symbol: 'ETHUSDT', size: 2, entryPrice: 3000 },
        ],
        getOrders: async () => [],
        getBalance: async () => ({ totalEquity: 10000, freeBalance: 8000, usedMargin: 2000, unrealizedPnl: 0, realizedPnl: 0, dailyPnl: 0, dailyTrades: 0, currency: 'USDT' }),
      } as any,
      recoverTrades: recoverTradesSpy,
    }))
    const report = await sr.recover()
    expect(report.recoveredPositions).toBe(2)
    expect(recoverTradesSpy).toHaveBeenCalledOnce()
    expect(report.recoveredTrades).toBe(2)  // from the spy
  })

  it('includes warnings from trade recovery', async () => {
    const sr = new StartupRecoveryRuntime(makeDeps({
      gateway: {
        isConnected: () => true,
        getPositions: async () => [
          { symbol: 'BTCUSDT', size: 0.5, entryPrice: 60000 },
        ],
        getOrders: async () => [],
        getBalance: async () => ({ totalEquity: 10000, freeBalance: 8000, usedMargin: 2000, unrealizedPnl: 0, realizedPnl: 0, dailyPnl: 0, dailyTrades: 0, currency: 'USDT' }),
      } as any,
      recoverTrades: async () => ({ recovered: 1, warnings: ['Position BTCUSDT has no entry price'], errors: [] }),
    }))
    const report = await sr.recover()
    expect(report.warnings).toContain('Position BTCUSDT has no entry price')
    expect(report.healthy).toBe(true)  // warnings don't make it unhealthy
  })

  it('includes errors from history sync', async () => {
    const sr = new StartupRecoveryRuntime(makeDeps({
      gateway: {
        isConnected: () => true,
        getPositions: async () => [
          { symbol: 'BTCUSDT', size: 0.5, entryPrice: 60000 },
        ],
        getOrders: async () => [],
        getBalance: async () => ({ totalEquity: 10000, freeBalance: 8000, usedMargin: 2000, unrealizedPnl: 0, realizedPnl: 0, dailyPnl: 0, dailyTrades: 0, currency: 'USDT' }),
      } as any,
      recoverTrades: async () => ({ recovered: 0, warnings: [], errors: [] }),
      syncHistory: async () => ({ warnings: [], errors: ['History store unavailable'] }),
    }))
    const report = await sr.recover()
    expect(report.errors).toContain('History store unavailable')
    expect(report.healthy).toBe(false)
  })

  it('measures durationMs', async () => {
    const sr = new StartupRecoveryRuntime(makeDeps({
      gateway: {
        isConnected: () => true,
        getPositions: async () => {
          await new Promise(r => setTimeout(r, 5))
          return []
        },
        getOrders: async () => [],
        getBalance: async () => ({ totalEquity: 10000, freeBalance: 8000, usedMargin: 2000, unrealizedPnl: 0, realizedPnl: 0, dailyPnl: 0, dailyTrades: 0, currency: 'USDT' }),
      } as any,
    }))
    const report = await sr.recover()
    expect(report.durationMs).toBeGreaterThanOrEqual(5)
  })
})
