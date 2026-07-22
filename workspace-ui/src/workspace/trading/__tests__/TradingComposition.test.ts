// ── TradingComposition / DependencyGraph / RuntimeFactory tests ──

import { describe, it, expect } from 'vitest'
import { DependencyGraph, RuntimeFactory, TradingComposition } from '../TradingComposition'
import { LifecycleManager } from '../LifecycleManager'
import { LIFECYCLE_STATES } from '../types'

describe('RuntimeFactory', () => {
  it('registers and creates runtimes', () => {
    const f = new RuntimeFactory()
    expect(f.registered).toEqual([])

    f.register('gateway', () => ({ name: 'gw' }))
    f.register('risk', () => ({ name: 'risk' }))

    expect(f.registered).toEqual(['gateway', 'risk'])
    expect(f.create<any>('gateway')?.name).toBe('gw')
    expect(f.create<any>('risk')?.name).toBe('risk')
  })

  it('returns undefined for unregistered runtime', () => {
    const f = new RuntimeFactory()
    expect(f.create('gateway')).toBeUndefined()
  })
})

describe('DependencyGraph', () => {
  it('returns startup order respecting dependencies', () => {
    const dg = new DependencyGraph()
    dg.add('feed', 'gateway')    // feed before gateway
    dg.add('gateway', 'risk')    // gateway before risk
    dg.add('risk', 'trade')      // risk before trade

    const order = dg.startupOrder()
    expect(order.indexOf('feed')).toBeLessThan(order.indexOf('gateway'))
    expect(order.indexOf('gateway')).toBeLessThan(order.indexOf('risk'))
    expect(order.indexOf('risk')).toBeLessThan(order.indexOf('trade'))
  })

  it('shutdown order is reverse of startup', () => {
    const dg = new DependencyGraph()
    dg.add('feed', 'gateway')
    dg.add('gateway', 'risk')

    const startup = dg.startupOrder()
    const shutdown = dg.shutdownOrder()
    expect(shutdown).toEqual([...startup].reverse())
  })

  it('handles empty graph', () => {
    const dg = new DependencyGraph()
    expect(dg.startupOrder()).toEqual([])
    expect(dg.shutdownOrder()).toEqual([])
  })

  it('handles diamond dependencies without error', () => {
    const dg = new DependencyGraph()
    dg.add('feed', 'gateway')
    dg.add('gateway', 'trade')
    dg.add('risk', 'trade')

    const order = dg.startupOrder()
    expect(order).toContain('feed')
    expect(order).toContain('gateway')
    expect(order).toContain('risk')
    expect(order).toContain('trade')
    expect(order.indexOf('gateway')).toBeLessThan(order.indexOf('trade'))
    expect(order.indexOf('risk')).toBeLessThan(order.indexOf('trade'))
  })
})

describe('TradingComposition', () => {
  it('holds config, factory, graph, lifecycleManager and workspace', () => {
    const config = { name: 'test', broker: 'bybit', symbols: ['BTCUSDT'], mode: 'paper' as const }
    const lm = new LifecycleManager()
    const f = new RuntimeFactory()
    const dg = new DependencyGraph()
    const ws = { start: async () => ({}), stop: async () => {}, health: () => ({ status: 'CREATED' as any, uptimeMs: 0, gatewayConnected: false, runtimes: {} as any }) } as any

    const comp = new TradingComposition({ config, runtimeFactory: f, dependencyGraph: dg, lifecycleManager: lm, workspace: ws })
    expect(comp.config.name).toBe('test')
    expect(comp.runtimeFactory).toBe(f)
    expect(comp.dependencyGraph).toBe(dg)
    expect(comp.lifecycleManager).toBe(lm)
    expect(comp.workspace).toBe(ws)
  })

  it('startupPlan and shutdownPlan mirror dependency graph', () => {
    const dg = new DependencyGraph()
    dg.add('feed', 'risk')
    dg.add('risk', 'trade')
    const comp = new TradingComposition({
      config: { name: 't', broker: 'b', symbols: ['X'], mode: 'paper' as const },
      runtimeFactory: new RuntimeFactory(),
      dependencyGraph: dg,
      lifecycleManager: new LifecycleManager(),
      workspace: { start: async () => ({}), stop: async () => {}, health: () => ({}) } as any,
    })
    expect(comp.startupPlan).toEqual(['feed', 'risk', 'trade'])
    expect(comp.shutdownPlan).toEqual(['trade', 'risk', 'feed'])
  })
})
