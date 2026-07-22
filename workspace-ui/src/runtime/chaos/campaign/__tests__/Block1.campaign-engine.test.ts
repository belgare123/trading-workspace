/**
 * Block1.campaign-engine.test.ts — Campaign Engine Certification
 *
 * Sprint 6.6.6 — Full Chaos Campaign (Block 1)
 *
 * Validates the declarative Campaign DSL:
 *   1.1a  — DSL builds a timeline with inject/recover steps
 *   1.1b  — DSL builds a timeline with assert/certify steps
 *   1.2a  — Campaign runs and injects rules into FailureInjector
 *   1.2b  — Campaign recovers (removes) rules from FailureInjector
 *   1.3a  — Assertions are collected and reported
 *   1.3b  — Failed assertions are surfaced in the report
 *   1.4a  — Certification step evaluates all recorded assertions
 *   1.4b  — Certification fails when an assertion failed
 *   1.5a  — CampaignReport.text() produces a human-readable report
 *   1.5b  — Campaign can run with timeMultiplier=0 (instant)
 *   1.6a  — Campaign events are emitted via onEvent callback
 *
 * @since 6.6.6
 */

import { describe, it, expect } from 'vitest'
import { CampaignEngine } from '../CampaignEngine'
import { FailureInjector } from '../../FailureInjector'
import { FailureInjectionScope, LatencyRule, DisconnectRule } from '../..'

describe('Block 1 — Campaign Engine', () => {
  // ── 1.1: DSL Construction ──

  describe('Block 1.1 — DSL builds timeline', () => {
    it('1.1a — builds timeline with inject and recover steps', () => {
      const campaign = new CampaignEngine('test-a')
        .at(1000).inject(new LatencyRule('r1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 500 }))
        .at(3000).recover(FailureInjectionScope.REST)
        .at(5000).certify()

      // Access internal steps via casting to test
      const steps = (campaign as any).steps as any[]
      expect(steps).toHaveLength(3)
      expect(steps[0].action).toBe('inject')
      expect(steps[0].offsetMs).toBe(1000)
      expect(steps[1].action).toBe('recover')
      expect(steps[1].offsetMs).toBe(3000)
      expect(steps[2].action).toBe('certify')
      expect(steps[2].offsetMs).toBe(5000)
    })

    it('1.1b — builds timeline with assert and certify steps', () => {
      const campaign = new CampaignEngine('test-b')
        .assert({ name: 'check-1', fn: () => ({ name: 'check-1', status: 'passed' as const }) })
        .certify()

      const steps = (campaign as any).steps as any[]
      expect(steps).toHaveLength(2)
      expect(steps[0].action).toBe('assert')
      expect(steps[0].label).toBe('check-1')
      expect(steps[1].action).toBe('certify')
    })
  })

  // ── 1.2: Injection and Recovery ──

  describe('Block 1.2 — Campaign runs injection and recovery', () => {
    it('1.2a — injects rules into FailureInjector', async () => {
      const injector = new FailureInjector()
      expect(injector.activeRules).toHaveLength(0)

      const campaign = new CampaignEngine('test-inject', { timeMultiplier: 0 })
        .at(0).inject(new LatencyRule('r1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 500 }))

      const result = await campaign.run({ injector })
      expect(result.allPass).toBe(true)
      expect(injector.activeRules).toHaveLength(1)
      expect(injector.activeRules[0].id).toBe('r1')
    })

    it('1.2b — recovers (removes) rules from FailureInjector', async () => {
      const injector = new FailureInjector()
      injector.addRule(new DisconnectRule('d1', FailureInjectionScope.PRIVATE_WS, 1.0))
      expect(injector.activeRules).toHaveLength(1)

      const campaign = new CampaignEngine('test-recover', { timeMultiplier: 0 })
        .at(0).recover(FailureInjectionScope.PRIVATE_WS)

      const result = await campaign.run({ injector })
      expect(result.allPass).toBe(true)
      expect(injector.activeRules).toHaveLength(0)
    })
  })

  // ── 1.3: Assertions ──

  describe('Block 1.3 — Assertions are collected and reported', () => {
    it('1.3a — assertions are collected in the report', async () => {
      const campaign = new CampaignEngine('test-assert', { timeMultiplier: 0 })
        .assert({ name: 'always-pass', fn: () => ({ name: 'always-pass', status: 'passed' as const }) })
        .certify()

      const result = await campaign.run({})
      expect(result.totalAssertions).toBe(1)
      expect(result.passedAssertions).toBe(1)
      expect(result.failedAssertions).toBe(0)
      expect(result.allPass).toBe(true)
    })

    it('1.3b — failed assertions are surfaced in the report', async () => {
      const campaign = new CampaignEngine('test-fail', { timeMultiplier: 0 })
        .assert({ name: 'always-fail', fn: () => ({ name: 'always-fail', status: 'failed' as const, detail: 'expected failure' }) })
        .certify()

      const result = await campaign.run({})
      expect(result.totalAssertions).toBe(1)
      expect(result.passedAssertions).toBe(0)
      expect(result.failedAssertions).toBe(1)
      expect(result.allPass).toBe(false)
    })
  })

  // ── 1.4: Certification ──

  describe('Block 1.4 — Certification evaluates all assertions', () => {
    it('1.4a — certification passes when all assertions pass', async () => {
      const campaign = new CampaignEngine('test-cert-pass', { timeMultiplier: 0 })
        .assert({ name: 'a', fn: () => ({ name: 'a', status: 'passed' as const }) })
        .assert({ name: 'b', fn: () => ({ name: 'b', status: 'passed' as const }) })
        .certify()

      const result = await campaign.run({})
      expect(result.allPass).toBe(true)
      expect(result.steps[2].pass).toBe(true) // certify step
    })

    it('1.4b — certification fails when an assertion failed', async () => {
      const campaign = new CampaignEngine('test-cert-fail', { timeMultiplier: 0 })
        .assert({ name: 'a', fn: () => ({ name: 'a', status: 'passed' as const }) })
        .assert({ name: 'b', fn: () => ({ name: 'b', status: 'failed' as const, detail: 'broke' }) })
        .certify()

      const result = await campaign.run({})
      expect(result.allPass).toBe(false)
      expect(result.steps[2].pass).toBe(false) // certify step
      expect(result.steps[2].error).toContain('Certification failed')
    })
  })

  // ── 1.5: Report & Configuration ──

  describe('Block 1.5 — Report and configuration', () => {
    it('1.5a — CampaignReport.text() produces a human-readable report', async () => {
      const campaign = new CampaignEngine('Readable', { timeMultiplier: 0 })
        .assert({ name: 'ok', fn: () => ({ name: 'ok', status: 'passed' as const }) })
        .certify()

      const result = await campaign.run({})
      const text = result.text()
      expect(text).toContain('Campaign:          Readable')
      expect(text).toContain('Status:            PASS')
      expect(text).toContain('Assertions:        1')
    })

    it('1.5b — timeMultiplier=0 runs instantly', async () => {
      const start = Date.now()
      const campaign = new CampaignEngine('Instant', { timeMultiplier: 0 })
        .at(10000).inject(new LatencyRule('r1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 500 }))
        .at(20000).certify()

      const result = await campaign.run({})
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(1000) // should be < 1s for 20s virtual time
      expect(result.allPass).toBe(true)
    })
  })

  // ── 1.6: Events ──

  describe('Block 1.6 — Campaign events', () => {
    it('1.6a — events are emitted via onEvent callback', async () => {
      const events: any[] = []
      const campaign = new CampaignEngine('Events', { timeMultiplier: 0 })
        .at(0).inject(new LatencyRule('r1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 500 }))
        .assert({ name: 'check', fn: () => ({ name: 'check', status: 'passed' as const }) })
        .certify()

      await campaign.run({ onEvent: (ev) => events.push(ev) })
      const phases = events.map(e => e.phase)
      expect(phases).toContain('step_start')
      expect(phases).toContain('step_end')
      expect(phases).toContain('injection')
      expect(phases).toContain('assertion')
      expect(phases).toContain('certification')
      expect(phases).toContain('campaign_end')
      expect(events.length).toBeGreaterThanOrEqual(8)
    })
  })
})
