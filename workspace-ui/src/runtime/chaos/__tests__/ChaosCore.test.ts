/**
 * Chaos Runtime — Core tests
 *
 * @since 6.6
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FailureInjector } from '../FailureInjector'
import { NoopFailureInjector } from '../NoopFailureInjector'
import { SeededRandom } from '../SeededRandom'
import { FailureInjectionScope } from '../InjectionRule'
import {
  LatencyRule,
  TimeoutRule,
  DisconnectRule,
  ReconnectRule,
  PacketLossRule,
  PartialResponseRule,
  MalformedResponseRule,
  ConnectionRefusedRule,
  RateLimitRule,
} from '../InjectionRule'
import {
  NORMAL_PROFILE,
  EXCHANGE_SLOW_PROFILE,
  EXCHANGE_FLAKY_PROFILE,
  NETWORK_LOSS_PROFILE,
  RANDOM_CHAOS_PROFILE,
  BUILTIN_PROFILES,
} from '../FailureProfile'
import { ScenarioBuilder } from '../FailureScenario'
import {
  NoopFailureObserver,
  CompositeFailureObserver,
} from '../IFailureObserver'
import type { IFailureObserver, FailureObservation } from '../IFailureObserver'

// ════════════════════════════════════════════
// SeededRandom
// ════════════════════════════════════════════

describe('SeededRandom', () => {
  it('produces deterministic results for the same seed', () => {
    const r1 = new SeededRandom(42)
    const r2 = new SeededRandom(42)
    const seq1 = Array.from({ length: 10 }, () => r1.next())
    const seq2 = Array.from({ length: 10 }, () => r2.next())
    expect(seq1).toEqual(seq2)
  })

  it('produces different sequences for different seeds', () => {
    const r1 = new SeededRandom(42)
    const r2 = new SeededRandom(99)
    const v1 = r1.next()
    const v2 = r2.next()
    expect(v1).not.toBe(v2)
  })

  it('nextInt returns values in [min, max]', () => {
    const r = new SeededRandom(42)
    for (let i = 0; i < 100; i++) {
      const v = r.nextInt(5, 10)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('pick returns an element from the array', () => {
    const r = new SeededRandom(42)
    const arr = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(r.pick(arr))
    }
  })

  it('shuffle preserves all elements', () => {
    const r = new SeededRandom(42)
    const arr = [1, 2, 3, 4, 5]
    const shuffled = r.shuffle([...arr])
    expect(shuffled.sort()).toEqual(arr)
  })
})

// ════════════════════════════════════════════
// Injection Rules
// ════════════════════════════════════════════

describe('InjectionRules', () => {
  const random = new SeededRandom(42)
  const ctx = { scope: FailureInjectionScope.REST, url: 'https://api.bybit.com/v5/order/create', method: 'POST', timestamp: Date.now() }

  it('LatencyRule produces duration in range', () => {
    const rule = new LatencyRule('test', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 500 })
    expect(rule.matches(ctx)).toBe(true)
    for (let i = 0; i < 50; i++) {
      const action = rule.getAction(ctx, new SeededRandom(i * 100))
      if (action.type === 'latency') {
        expect(action.duration).toBeGreaterThanOrEqual(100)
        expect(action.duration).toBeLessThanOrEqual(500)
      }
    }
  })

  it('TimeoutRule returns timeout action', () => {
    const rule = new TimeoutRule('test', FailureInjectionScope.REST, 1.0, { durationMs: 10000 })
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('timeout')
  })

  it('DisconnectRule returns disconnect action', () => {
    const rule = new DisconnectRule('test', FailureInjectionScope.PRIVATE_WS, 1.0)
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('disconnect')
  })

  it('ReconnectRule returns reconnect with delay', () => {
    const rule = new ReconnectRule('test', FailureInjectionScope.PRIVATE_WS, 1.0, { delayMs: 2000 })
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('reconnect')
    if (action.type === 'reconnect') expect(action.delay).toBe(2000)
  })

  it('PacketLossRule returns packet_loss based on lossRate', () => {
    const rule = new PacketLossRule('test', FailureInjectionScope.REST, 1.0, { lossRate: 1.0 })
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('packet_loss')
  })

  it('PacketLossRule can return none when lossRate is low', () => {
    const rule = new PacketLossRule('test', FailureInjectionScope.REST, 1.0, { lossRate: 0.0 })
    // With lossRate=0, should always be 'none'
    let sawType = ''
    for (let i = 0; i < 20; i++) {
      const action = rule.getAction(ctx, new SeededRandom(i * 100))
      if (action.type !== 'none') sawType = action.type
    }
    expect(sawType).toBe('')
  })

  it('PartialResponseRule returns partial_response', () => {
    const rule = new PartialResponseRule('test', FailureInjectionScope.REST, 1.0, { size: 50 })
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('partial_response')
    if (action.type === 'partial_response') expect(action.size).toBe(50)
  })

  it('MalformedResponseRule returns malformed_response', () => {
    const rule = new MalformedResponseRule('test', FailureInjectionScope.REST, 1.0)
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('malformed_response')
  })

  it('ConnectionRefusedRule returns connection_refused', () => {
    const rule = new ConnectionRefusedRule('test', FailureInjectionScope.REST, 1.0)
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('connection_refused')
  })

  it('RateLimitRule returns rate_limit with default code 429', () => {
    const rule = new RateLimitRule('test', FailureInjectionScope.REST, 1.0)
    const action = rule.getAction(ctx, random)
    expect(action.type).toBe('rate_limit')
    if (action.type === 'rate_limit') {
      expect(action.code).toBe(429)
      expect(action.retryAfterMs).toBeGreaterThan(0)
    }
  })

  it('clone() produces an independent rule with same parameters', () => {
    const rule = new LatencyRule('orig', FailureInjectionScope.ORDERS, 0.5, { minMs: 100, maxMs: 200 })
    const cloned = rule.clone()
    expect(cloned.id).toBe('orig')
    expect(cloned.scope).toBe(FailureInjectionScope.ORDERS)
    expect(cloned.probability).toBe(0.5)
    // Modifying clone should not affect original
    expect(rule).not.toBe(cloned)
  })
})

// ════════════════════════════════════════════
// FailureInjector Core
// ════════════════════════════════════════════

describe('FailureInjector', () => {
  let injector: FailureInjector

  beforeEach(() => {
    injector = new FailureInjector(new SeededRandom(42))
  })

  it('starts with no active rules', () => {
    expect(injector.activeRules).toHaveLength(0)
  })

  it('addRule adds a rule', () => {
    const rule = new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 })
    injector.addRule(rule)
    expect(injector.activeRules).toHaveLength(1)
  })

  it('removeRule removes a rule by id', () => {
    const rule = new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 })
    injector.addRule(rule)
    injector.removeRule('t1')
    expect(injector.activeRules).toHaveLength(0)
  })

  it('clearAll removes all rules', () => {
    injector.addRule(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }))
    injector.addRule(new TimeoutRule('t2', FailureInjectionScope.REST, 1.0, { durationMs: 5000 }))
    injector.clearAll()
    expect(injector.activeRules).toHaveLength(0)
  })

  it('matchingRules returns only rules matching scope', () => {
    const restRule = new LatencyRule('rest', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 })
    const wsRule = new LatencyRule('ws', FailureInjectionScope.PRIVATE_WS, 1.0, { minMs: 100, maxMs: 200 })
    injector.addRule(restRule)
    injector.addRule(wsRule)

    const restCtx = { scope: FailureInjectionScope.REST, url: '/v5/order', method: 'POST', timestamp: Date.now() }
    const matched = injector.matchingRules(restCtx)
    expect(matched).toHaveLength(1)
    expect(matched[0].id).toBe('rest')
  })

  it('evaluate returns none when no rule matches', async () => {
    const action = await injector.evaluate({
      scope: FailureInjectionScope.REST,
      url: '/test',
      timestamp: Date.now(),
    })
    expect(action.type).toBe('none')
  })

  it('evaluate returns rule action when probability fires', async () => {
    injector.addRule(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }))
    const action = await injector.evaluate({
      scope: FailureInjectionScope.REST,
      url: '/v5/order',
      method: 'POST',
      timestamp: Date.now(),
    })
    expect(action.type).toBe('latency')
  })

  it('evaluate respects probability (0.0 = never)', async () => {
    injector.addRule(new LatencyRule('t1', FailureInjectionScope.REST, 0.0, { minMs: 100, maxMs: 200 }))
    const action = await injector.evaluate({
      scope: FailureInjectionScope.REST,
      url: '/test',
      timestamp: Date.now(),
    })
    expect(action.type).toBe('none')
  })

  it('setProfile atomically swaps all rules', () => {
    injector.setProfile(EXCHANGE_SLOW_PROFILE)
    expect(injector.activeRules).toHaveLength(2)
    injector.setProfile(NORMAL_PROFILE)
    expect(injector.activeRules).toHaveLength(0)
  })

  it('setSeed changes the random source', () => {
    injector.setSeed(42)
    const v1 = injector.randomSource.next()
    injector.setSeed(42)
    const v2 = injector.randomSource.next()
    expect(v1).toBe(v2)
  })

  it('events fire on rule add/remove', () => {
    const events: string[] = []
    injector.on(e => events.push(e.type))
    injector.addRule(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }))
    expect(events).toContain('rule_added')
    injector.removeRule('t1')
    expect(events).toContain('rule_removed')
  })

  it('evaluate respects scope filtering', async () => {
    // Only PRIVATE_WS rules
    injector.addRule(new DisconnectRule('dc', FailureInjectionScope.PRIVATE_WS, 1.0))
    const restCtx = { scope: FailureInjectionScope.REST, url: '/test', timestamp: Date.now() }
    const wsCtx = { scope: FailureInjectionScope.PRIVATE_WS, url: '/private', timestamp: Date.now() }

    expect((await injector.evaluate(restCtx)).type).toBe('none')
    expect((await injector.evaluate(wsCtx)).type).toBe('disconnect')
  })

  // ── Observer integration ──

  it('notifies observer on rule_matched and injection_started', async () => {
    const events: FailureObservation[] = []
    const obs: IFailureObserver = { observe: e => events.push(e) }
    injector.setObserver(obs)

    injector.addRule(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 10, maxMs: 20 }))
    await injector.evaluate({ scope: FailureInjectionScope.REST, url: '/test', timestamp: Date.now() })

    const types = events.map(e => e.type)
    expect(types).toContain('rule_matched')
    expect(types).toContain('injection_started')
    expect(events[0].ruleId).toBe('t1')
  })

  it('notifies observer on scenario_started and scenario_stopped', async () => {
    const events: FailureObservation[] = []
    const obs: IFailureObserver = { observe: e => events.push(e) }
    injector.setObserver(obs)

    const scenario = new ScenarioBuilder()
      .wait(10_000)
      .inject(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 10, maxMs: 20 }))
      .build('long', 'never finishes')

    injector.startScenario(scenario)
    injector.stopScenario()

    expect(events.some(e => e.type === 'scenario_started')).toBe(true)
    expect(events.some(e => e.type === 'scenario_stopped')).toBe(true)
  })

  it('injectionFinished notifies observer with duration', () => {
    const events: FailureObservation[] = []
    const obs: IFailureObserver = { observe: e => events.push(e) }
    injector.setObserver(obs)

    const ctx = { scope: FailureInjectionScope.REST, url: '/test', timestamp: Date.now() }
    const action: any = { type: 'latency' as const, duration: 50 }
    injector.injectionFinished(ctx, action, 52)

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('injection_finished')
    expect(events[0].durationMs).toBe(52)
  })
})

// ════════════════════════════════════════════
// NoopFailureInjector
// ════════════════════════════════════════════

describe('NoopFailureInjector', () => {
  it('never returns an active rule', () => {
    const noop = new NoopFailureInjector()
    expect(noop.activeRules).toHaveLength(0)
  })

  it('always returns none', async () => {
    const noop = new NoopFailureInjector()
    expect(noop.evaluateSync({ scope: FailureInjectionScope.GLOBAL, timestamp: Date.now() }).type).toBe('none')
    const action = await noop.evaluate({ scope: FailureInjectionScope.GLOBAL, timestamp: Date.now() })
    expect(action.type).toBe('none')
  })

  it('all methods are no-ops', () => {
    const noop = new NoopFailureInjector()
    expect(() => noop.addRule(new LatencyRule('t', FailureInjectionScope.GLOBAL, 1.0, { minMs: 1, maxMs: 2 }))).not.toThrow()
    expect(() => noop.clearAll()).not.toThrow()
    expect(() => noop.setProfile(NORMAL_PROFILE)).not.toThrow()
    expect(() => noop.setSeed(42)).not.toThrow()
    expect(() => noop.setObserver(new NoopFailureObserver())).not.toThrow()
    expect(() => noop.injectionFinished({ scope: FailureInjectionScope.GLOBAL, timestamp: 0 }, { type: 'none' }, 0)).not.toThrow()
    expect(noop.activeScenario).toBeNull()
    expect(noop.compositeObserver).toBeNull()
  })
})

// ════════════════════════════════════════════
// Profiles
// ════════════════════════════════════════════

describe('FailureProfiles', () => {
  it('NORMAL_PROFILE has no rules', () => {
    expect(NORMAL_PROFILE.rules).toHaveLength(0)
    expect(NORMAL_PROFILE.id).toBe('normal')
  })

  it('EXCHANGE_SLOW_PROFILE has 2 latency rules', () => {
    expect(EXCHANGE_SLOW_PROFILE.rules).toHaveLength(2)
    for (const rule of EXCHANGE_SLOW_PROFILE.rules) {
      expect(rule).toBeInstanceOf(LatencyRule)
    }
  })

  it('EXCHANGE_FLAKY_PROFILE has 6 rules', () => {
    expect(EXCHANGE_FLAKY_PROFILE.rules).toHaveLength(6)
  })

  it('NETWORK_LOSS_PROFILE has 6 rules', () => {
    expect(NETWORK_LOSS_PROFILE.rules).toHaveLength(6)
  })

  it('RANDOM_CHAOS_PROFILE has 9 rules', () => {
    expect(RANDOM_CHAOS_PROFILE.rules).toHaveLength(9)
  })

  it('BUILTIN_PROFILES contains all profiles', () => {
    expect(Object.keys(BUILTIN_PROFILES)).toEqual([
      'normal', 'exchange-slow', 'exchange-flaky', 'network-loss', 'random-chaos',
    ])
  })

  it('applying a profile via injector makes rules active', () => {
    const injector = new FailureInjector(new SeededRandom(1))
    injector.setProfile(EXCHANGE_FLAKY_PROFILE)
    expect(injector.activeRules).toHaveLength(6)
  })
})

// ════════════════════════════════════════════
// Scenario Builder
// ════════════════════════════════════════════

describe('ScenarioBuilder', () => {
  it('builds a scenario with timeline steps', () => {
    const scenario = new ScenarioBuilder()
      .wait(5_000)
      .inject(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }), 'latency on rest')
      .wait(10_000)
      .inject(new DisconnectRule('dc', FailureInjectionScope.PRIVATE_WS, 1.0), 'disconnect private ws')
      .wait(2_000)
      .clearAll('clear everything')
      .build('test-scenario', 'Test timeline', 42)

    expect(scenario.id).toBe('test-scenario')
    expect(scenario.seed).toBe(42)
    expect(scenario.steps).toHaveLength(3)

    expect(scenario.steps[0].at).toBe(5_000)
    expect(scenario.steps[0].action.type).toBe('inject')

    expect(scenario.steps[1].at).toBe(15_000)
    expect(scenario.steps[1].action.type).toBe('inject')

    expect(scenario.steps[2].at).toBe(17_000)
    expect(scenario.steps[2].action.type).toBe('clear_all')
  })

  it('at() sets absolute time', () => {
    const scenario = new ScenarioBuilder()
      .at(10_000)
      .inject(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }))
      .at(20_000)
      .clearAll()
      .build('abs', 'absolute time test')

    expect(scenario.steps[0].at).toBe(10_000)
    expect(scenario.steps[1].at).toBe(20_000)
  })
})

// ════════════════════════════════════════════
// Scenario execution (timeline)
// ════════════════════════════════════════════

describe('Scenario execution', () => {
  it('startScenario clears rules and schedules steps', async () => {
    const injector = new FailureInjector(new SeededRandom(1))
    injector.setProfile(EXCHANGE_SLOW_PROFILE)
    expect(injector.activeRules).toHaveLength(2)

    const scenario = new ScenarioBuilder()
      .wait(50)
      .inject(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }))
      .build('scenario-1', 'Test scenario', 42)

    injector.startScenario(scenario)
    expect(injector.activeRules).toHaveLength(0) // cleared
    expect(injector.activeScenario).not.toBeNull()

    // Wait for the step to fire
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(injector.activeRules).toHaveLength(1)

    injector.stopScenario()
  })

  it('stopScenario cancels pending steps', async () => {
    const injector = new FailureInjector()
    const scenario = new ScenarioBuilder()
      .wait(10_000) // long wait
      .inject(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }))
      .build('long', 'never finishes')

    injector.startScenario(scenario)
    injector.stopScenario()
    expect(injector.activeScenario).toBeNull()

    // Verify no rule was injected
    expect(injector.activeRules).toHaveLength(0)
  })
})

// ════════════════════════════════════════════
// IFailureObserver
// ════════════════════════════════════════════

describe('IFailureObserver', () => {
  it('NoopFailureObserver never throws', () => {
    const o = new NoopFailureObserver()
    expect(() => o.observe({ type: 'injection_started', timestamp: 0 })).not.toThrow()
    expect(() => o.observe({ type: 'rule_matched', timestamp: 0 })).not.toThrow()
    expect(() => o.observe({ type: 'injection_finished', timestamp: 0 })).not.toThrow()
  })

  it('CompositeFailureObserver fans out to all children', () => {
    const received: string[] = []
    const obs1: IFailureObserver = { observe: e => received.push(`a:${e.type}`) }
    const obs2: IFailureObserver = { observe: e => received.push(`b:${e.type}`) }

    const composite = new CompositeFailureObserver()
    composite.add(obs1)
    composite.add(obs2)
    composite.observe({ type: 'injection_started', timestamp: 42 })

    expect(received).toEqual(['a:injection_started', 'b:injection_started'])
  })

  it('CompositeFailureObserver.remove stops forwarding', () => {
    const received: string[] = []
    const obs: IFailureObserver = { observe: e => received.push(e.type) }

    const composite = new CompositeFailureObserver()
    composite.add(obs)
    composite.remove(obs)
    composite.observe({ type: 'injection_started', timestamp: 0 })

    expect(received).toHaveLength(0)
  })

  it('CompositeFailureObserver swallows child errors', () => {
    const throwing: IFailureObserver = { observe: () => { throw new Error('oops') } }
    const composite = new CompositeFailureObserver()
    composite.add(throwing)
    expect(() => composite.observe({ type: 'injection_started', timestamp: 0 })).not.toThrow()
  })

  it('injector can be constructed with an observer', () => {
    const events: FailureObservation[] = []
    const obs: IFailureObserver = { observe: e => events.push(e) }
    const inj = new FailureInjector(new SeededRandom(1), obs)

    inj.addRule(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 10, maxMs: 20 }))
    inj.evaluateSync({ scope: FailureInjectionScope.REST, url: '/test', timestamp: Date.now() })

    expect(events.some(e => e.type === 'injection_started')).toBe(true)
  })

  it('injector.setObserver replaces the current observer', () => {
    const events1: FailureObservation[] = []
    const events2: FailureObservation[] = []
    const obs1: IFailureObserver = { observe: e => events1.push(e) }
    const obs2: IFailureObserver = { observe: e => events2.push(e) }

    const inj = new FailureInjector(new SeededRandom(1), obs1)
    inj.setObserver(obs2)

    inj.addRule(new LatencyRule('t1', FailureInjectionScope.REST, 1.0, { minMs: 10, maxMs: 20 }))
    inj.evaluateSync({ scope: FailureInjectionScope.REST, url: '/test', timestamp: Date.now() })

    expect(events1).toHaveLength(0) // old observer not called
    expect(events2.some(e => e.type === 'injection_started')).toBe(true)
  })
})

// ════════════════════════════════════════════
// Failure Context (rich InjectionContext fields)
// ════════════════════════════════════════════

describe('FailureContext (rich context)', () => {
  it('InjectionContext supports operation field', () => {
    const ctx = {
      scope: FailureInjectionScope.ORDERS,
      url: '/v5/order/create',
      method: 'POST',
      operation: 'placeOrder',
      symbol: 'XRPUSDT',
      strategyId: 'SmaCross',
      traceId: 'trace-001',
      timestamp: Date.now(),
    }
    expect(ctx.operation).toBe('placeOrder')
    expect(ctx.symbol).toBe('XRPUSDT')
    expect(ctx.strategyId).toBe('SmaCross')
    expect(ctx.traceId).toBe('trace-001')
  })

  it('rule can match on context fields (not just scope)', () => {
    // Custom rule that matches ONLY a specific symbol
    const symbolRule: import('../InjectionRule').InjectionRule = {
      id: 'xrp-only',
      scope: FailureInjectionScope.ORDERS,
      probability: 1.0,
      matches: (ctx: import('../InjectionRule').InjectionContext) =>
        ctx.scope === FailureInjectionScope.ORDERS && ctx.symbol === 'XRPUSDT',
      getAction: () => ({ type: 'rate_limit', code: 429, retryAfterMs: 5000 }),
      clone: function () { return { ...this, matches: this.matches, getAction: this.getAction } },
    }

    const injector = new FailureInjector(new SeededRandom(1))
    injector.addRule(symbolRule)

    // Matching context
    const matchCtx = { scope: FailureInjectionScope.ORDERS, symbol: 'XRPUSDT', timestamp: Date.now() }
    expect(injector.matchingRules(matchCtx)).toHaveLength(1)

    // Non-matching context (different symbol)
    const noMatchCtx = { scope: FailureInjectionScope.ORDERS, symbol: 'BTCUSDT', timestamp: Date.now() }
    expect(injector.matchingRules(noMatchCtx)).toHaveLength(0)

    // Non-matching context (different scope)
    const wrongScopeCtx = { scope: FailureInjectionScope.REST, symbol: 'XRPUSDT', timestamp: Date.now() }
    expect(injector.matchingRules(wrongScopeCtx)).toHaveLength(0)
  })

  it('operation is inferred from URL in WrappedFetch', async () => {
    // This test verifies the operation inference logic by
    // checking the WrappedFetch creates context with the right operation.
    // We use a simple strategy: check that the injector receives
    // the operation in the context during evaluate.

    let capturedContext: any = null
    const injector = new (class extends FailureInjector {
      async evaluate(ctx: any) {
        capturedContext = ctx
        return { type: 'none' }
      }
    })()

    const { wrapFetch } = await import('../WrappedFetch')
    const original = async () => new Response('{}', { status: 200 })
    const wrapped = wrapFetch(original as any, injector as any)
    await wrapped('https://api.bybit.com/v5/order/create', { method: 'POST' })

    expect(capturedContext).not.toBeNull()
    expect(capturedContext.operation).toBe('placeOrder')
    expect(capturedContext.scope).toBe(FailureInjectionScope.ORDERS)
  })
})

// ════════════════════════════════════════════
// Determinism
// ════════════════════════════════════════════

describe('Determinism', () => {
  it('same seed produces identical evaluation sequences', async () => {
    const ctx = { scope: FailureInjectionScope.REST, url: '/v5/order', method: 'POST', timestamp: Date.now() }

    const run = async (seed: number) => {
      const injector = new FailureInjector(new SeededRandom(seed))
      injector.setProfile(RANDOM_CHAOS_PROFILE)
      const actions: string[] = []
      for (let i = 0; i < 20; i++) {
        const action = await injector.evaluate(ctx)
        actions.push(action.type)
      }
      return actions
    }

    const seq1 = await run(42)
    const seq2 = await run(42)
    expect(seq1).toEqual(seq2)
  })

  it('different seeds produce different sequences', async () => {
    const ctx = { scope: FailureInjectionScope.REST, url: '/v5/order', method: 'POST', timestamp: Date.now() }

    const run = async (seed: number) => {
      const injector = new FailureInjector(new SeededRandom(seed))
      injector.setProfile(RANDOM_CHAOS_PROFILE)
      const actions: string[] = []
      for (let i = 0; i < 20; i++) {
        const action = await injector.evaluate(ctx)
        actions.push(action.type)
      }
      return actions
    }

    const seq1 = await run(42)
    const seq2 = await run(99)
    expect(seq1).not.toEqual(seq2)
  })
})
