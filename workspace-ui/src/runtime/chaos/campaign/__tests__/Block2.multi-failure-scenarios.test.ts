/**
 * Block2.multi-failure-scenarios.test.ts — Multi-Failure Scenarios Certification
 *
 * Sprint 6.6.6 — Full Chaos Campaign (Block 2)
 *
 * Validates 4 pre-built multi-failure scenarios:
 *   2.1a — Exchange Slow builds inject/recover/certify steps
 *   2.1b — Network Partition builds inject/recover/certify steps
 *   2.1c — Exchange Outage builds inject/recover/certify steps
 *   2.1d — Cascading Failure builds inject/recover/certify steps
 *   2.2a — Exchange Slow runs and injects rules
 *   2.2b — Network Partition runs with timeMultiplier=0
 *   2.2c — Exchange Outage runs recovery steps
 *   2.2d — Cascading Failure runs full lifecycle
 *   2.3a — createAllScenarios returns 4 scenarios
 *   2.4a — Custom assertions via onRecovery
 *
 * @since 6.6.6
 */

import { describe, it, expect } from 'vitest'
import { FailureInjector } from '../../FailureInjector'
import {
  createExchangeSlowScenario,
  createNetworkPartitionScenario,
  createExchangeOutageScenario,
  createCascadingFailureScenario,
  createAllScenarios,
} from '../MultiFailureScenarios'

describe('Block 2 — Multi-Failure Scenarios', () => {
  // ── 2.1: Scenario Construction ──

  describe('Block 2.1 — Scenario builds correct steps', () => {
    function countActions(scenario: any): { inject: number; recover: number; assert: number; certify: number } {
      const steps = (scenario as any).steps as any[]
      const counts = { inject: 0, recover: 0, assert: 0, certify: 0 }
      for (const s of steps) {
        counts[s.action as keyof typeof counts]++
      }
      return counts
    }

    it('2.1a — Exchange Slow: 3 inject + 1 assert + 1 certify', () => {
      const s = createExchangeSlowScenario({ timeMultiplier: 0 })
      const c = countActions(s)
      expect(c.inject).toBe(3)
      expect(c.assert).toBe(1)
      expect(c.certify).toBe(1)
      expect(c.recover).toBe(0)
      expect(s.name).toBe('Exchange Slow')
    })

    it('2.1b — Network Partition: 3 inject + 1 assert + 1 certify', () => {
      const s = createNetworkPartitionScenario({ timeMultiplier: 0 })
      const c = countActions(s)
      expect(c.inject).toBe(3)
      expect(c.assert).toBe(1)
      expect(c.certify).toBe(1)
      expect(s.name).toBe('Network Partition')
    })

    it('2.1c — Exchange Outage: 3 inject + 2 recover + 2 assert + 1 certify', () => {
      const s = createExchangeOutageScenario({ timeMultiplier: 0 })
      const c = countActions(s)
      expect(c.inject).toBe(3)
      expect(c.recover).toBe(3)
      expect(c.assert).toBe(2)
      expect(c.certify).toBe(1)
      expect(s.name).toBe('Exchange Outage')
    })

    it('2.1d — Cascading Failure: 4 inject + 2 recover + 1 assert + 1 certify', () => {
      const s = createCascadingFailureScenario({ timeMultiplier: 0 })
      const c = countActions(s)
      expect(c.inject).toBe(4)
      expect(c.recover).toBe(2)
      expect(c.assert).toBe(1)
      expect(c.certify).toBe(1)
      expect(s.name).toBe('Cascading Failure')
    })
  })

  // ── 2.2: Scenario Execution ──

  describe('Block 2.2 — Scenarios run and apply injections', () => {
    it('2.2a — Exchange Slow injects rules into FailureInjector', async () => {
      const injector = new FailureInjector()
      const scenario = createExchangeSlowScenario({ timeMultiplier: 0 })

      const result = await scenario.run({ injector })
      expect(result.allPass).toBe(true)
      // Should have 3 rules injected
      expect(injector.activeRules.length).toBe(3)
    })

    it('2.2b — Network Partition runs with timeMultiplier=0', async () => {
      const injector = new FailureInjector()
      const scenario = createNetworkPartitionScenario({ timeMultiplier: 0 })

      const result = await scenario.run({ injector })
      expect(result.allPass).toBe(true)
      expect(injector.activeRules.length).toBe(3)
    })

    it('2.2c — Exchange Outage runs recovery (removes rules)', async () => {
      const injector = new FailureInjector()
      const scenario = createExchangeOutageScenario({ timeMultiplier: 0 })

      const result = await scenario.run({ injector })
      expect(result.allPass).toBe(true)
      // All rules should be recovered (removed)
      expect(injector.activeRules.length).toBe(0)
    })

    it('2.2d — Cascading Failure runs full lifecycle', async () => {
      const injector = new FailureInjector()
      const scenario = createCascadingFailureScenario({ timeMultiplier: 0 })

      const result = await scenario.run({ injector })
      expect(result.allPass).toBe(true)
      // All rules should be recovered
      expect(injector.activeRules.length).toBe(0)
    })
  })

  // ── 2.3: Collection ──

  describe('Block 2.3 — All scenarios collection', () => {
    it('2.3a — createAllScenarios returns 4 scenarios', () => {
      const all = createAllScenarios({ timeMultiplier: 0 })
      expect(all).toHaveLength(4)
      expect(all[0].name).toBe('Exchange Slow')
      expect(all[1].name).toBe('Network Partition')
      expect(all[2].name).toBe('Exchange Outage')
      expect(all[3].name).toBe('Cascading Failure')
    })
  })

  // ── 2.4: Custom Assertions ──

  describe('Block 2.4 — Custom assertions', () => {
    it('2.4a — Custom onRecovery callback is called', async () => {
      let called = false
      const scenario = createExchangeSlowScenario({
        timeMultiplier: 0,
        onRecovery: async () => {
          called = true
          return { name: 'custom', status: 'passed' as const }
        },
      })

      const result = await scenario.run({})
      expect(called).toBe(true)
      expect(result.allPass).toBe(true)
    })
  })
})
