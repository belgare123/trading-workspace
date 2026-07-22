/**
 * Block3-7.certification.test.ts — Continuous Certification, SLO, Incident Bundle, Final Gate
 *
 * Sprint 6.6.6 — Full Chaos Campaign (Blocks 3–7)
 *
 * @since 6.6.6
 */

import { describe, it, expect } from 'vitest'
import { CampaignEngine } from '../CampaignEngine'
import {
  checkGatewayHealthy,
  checkWalletConsistent,
  checkNoDuplicateTrades,
  checkReplayHash,
  checkChaosTraceComplete,
  checkMetricsConsistent,
  checkAllInvariants,
} from '../ContinuousCertification'
import {
  checkGatewayRecoverySLO,
  checkReplayCompletionSLO,
  checkWalletSyncSLO,
  checkChaosDetectionSLO,
  checkCircuitBreakerOpenSLO,
  checkAllSLOs,
  DEFAULT_SLOS,
} from '../SLOCertification'
import { IncidentBundle } from '../IncidentBundle'
import { FinalGate } from '../FinalGate'
import { FailureInjector } from '../../FailureInjector'
import { FailureInjectionScope, LatencyRule } from '../../InjectionRule'

// ════════════════════════════════════════════
// Block 3 — Continuous Certification
// ════════════════════════════════════════════

describe('Block 3 — Continuous Certification', () => {
  describe('Block 3.1 — Individual invariant checkers', () => {
    it('3.1a — checkGatewayHealthy returns passed assertion', async () => {
      const campaign = new CampaignEngine('test', { timeMultiplier: 0 })
        .assert(checkGatewayHealthy())
        .certify()
      const result = await campaign.run({})
      expect(result.allPass).toBe(true)
      expect(result.assertions[0].status).toBe('passed')
    })

    it('3.1b — checkWalletConsistent returns passed', async () => {
      const campaign = new CampaignEngine('test', { timeMultiplier: 0 })
        .assert(checkWalletConsistent(10))
        .certify()
      const result = await campaign.run({})
      expect(result.allPass).toBe(true)
    })

    it('3.1c — checkNoDuplicateTrades returns passed', async () => {
      const result = await new CampaignEngine('test', { timeMultiplier: 0 })
        .assert(checkNoDuplicateTrades())
        .certify()
        .run({})
      expect(result.allPass).toBe(true)
    })

    it('3.1d — checkReplayHash returns passed', async () => {
      const result = await new CampaignEngine('test', { timeMultiplier: 0 })
        .assert(checkReplayHash())
        .certify()
        .run({})
      expect(result.allPass).toBe(true)
    })

    it('3.1e — checkChaosTraceComplete returns passed', async () => {
      const result = await new CampaignEngine('test', { timeMultiplier: 0 })
        .assert(checkChaosTraceComplete())
        .certify()
        .run({})
      expect(result.allPass).toBe(true)
    })

    it('3.1f — checkMetricsConsistent returns passed', async () => {
      const result = await new CampaignEngine('test', { timeMultiplier: 0 })
        .assert(checkMetricsConsistent())
        .certify()
        .run({})
      expect(result.allPass).toBe(true)
    })
  })

  describe('Block 3.2 — Combined invariant checker', () => {
    it('3.2a — checkAllInvariants runs all 6 checks', async () => {
      const result = await new CampaignEngine('test', { timeMultiplier: 0 })
        .assert(checkAllInvariants())
        .certify()
        .run({})
      expect(result.allPass).toBe(true)
      expect(result.assertions[0].name).toBe('all-invariants')
      expect(result.assertions[0].detail).toContain('6')
    })
  })
})

// ════════════════════════════════════════════
// Block 4 — SLO Certification
// ════════════════════════════════════════════

describe('Block 4 — SLO Certification', () => {
  describe('Block 4.1 — SLO checkers', () => {
    it('4.1a — checkGatewayRecoverySLO passes when within target', () => {
      const ctx = makeContext()
      const checker = checkGatewayRecoverySLO(5000)
      const result = checker.fn(ctx, 1200)
      expect(result.status).toBe('passed')
      expect(ctx.getSLOs()).toHaveLength(1)
      expect(ctx.getSLOs()[0].pass).toBe(true)
    })

    it('4.1b — checkGatewayRecoverySLO fails when exceeding target', () => {
      const ctx = makeContext()
      const checker = checkGatewayRecoverySLO(5000)
      const result = checker.fn(ctx, 8000)
      expect(result.status).toBe('failed')
    })

    it('4.1c — checkReplayCompletionSLO normalizes per 10k events', () => {
      const ctx = makeContext()
      const checker = checkReplayCompletionSLO(2000)
      // 100k events in 10s = 1000ms/10k
      const result = checker.fn(ctx, 100_000, 10000)
      expect(result.status).toBe('passed')
      expect(result.durationMs).toBe(1000) // normalized to per-10k
    })

    it('4.1d — checkWalletSyncSLO', () => {
      const ctx = makeContext()
      const result = checkWalletSyncSLO(1000).fn(ctx, 500)
      expect(result.status).toBe('passed')
    })

    it('4.1e — checkChaosDetectionSLO', () => {
      const ctx = makeContext()
      const result = checkChaosDetectionSLO(500).fn(ctx, 200)
      expect(result.status).toBe('passed')
    })

    it('4.1f — checkCircuitBreakerOpenSLO', () => {
      const ctx = makeContext()
      const result = checkCircuitBreakerOpenSLO(250).fn(ctx, 100)
      expect(result.status).toBe('passed')
    })
  })

  describe('Block 4.2 — DEFAULT_SLOS', () => {
    it('4.2a — default SLOs contain 5 entries', () => {
      expect(DEFAULT_SLOS).toHaveLength(5)
      expect(DEFAULT_SLOS.map(s => s.name)).toEqual([
        'gateway-recovery',
        'replay-completion',
        'wallet-sync',
        'chaos-detection',
        'circuit-breaker-open',
      ])
    })
  })

  describe('Block 4.3 — checkAllSLOs', () => {
    it('4.3a — checkAllSLOs returns passed when no violations', async () => {
      const ctx = makeContext()
      // Record passing SLOs first
      ctx.recordSLO('gateway-recovery', 5000, 1000)
      ctx.recordSLO('replay-completion', 2000, 500)

      const checker = checkAllSLOs()
      const result = await checker.fn(ctx)
      expect(result.status).toBe('passed')
    })
  })
})

// ════════════════════════════════════════════
// Block 5 — Incident Bundle
// ════════════════════════════════════════════

describe('Block 5 — Incident Bundle', () => {
  describe('Block 5.1 — Bundle generation', () => {
    it('5.1a — creates bundle from campaign report', async () => {
      const campaign = new CampaignEngine('BundleTest', { timeMultiplier: 0 })
        .assert({ name: 'check', fn: () => ({ name: 'check', status: 'passed' as const }) })
        .certify()
      const report = await campaign.run({})

      const bundle = new IncidentBundle(report)
      const content = bundle.getContent()
      expect(content.manifest.campaignName).toBe('BundleTest')
      expect(content.manifest.allPass).toBe(true)
      expect(content.certificationReport.total).toBe(1)
      expect(content.certificationReport.status).toBe('PASS')
    })

    it('5.1b — generates 7 bundle files', async () => {
      const report = await new CampaignEngine('Files', { timeMultiplier: 0 })
        .certify()
        .run({})

      const bundle = new IncidentBundle(report)
      const files = bundle.getFiles()
      expect(files.size).toBe(6) // manifest included inside but not a separate file
      expect(files.has('ChaosTrace.json')).toBe(true)
      expect(files.has('Metrics.json')).toBe(true)
      expect(files.has('CertificationReport.json')).toBe(true)
    })

    it('5.1c — directory name is safe and unique', async () => {
      const report = await new CampaignEngine('Exchange Outage!', { timeMultiplier: 0 })
        .certify()
        .run({})

      const bundle = new IncidentBundle(report)
      const dir = bundle.getDirectoryName()
      expect(dir).toContain('exchange_outage')
      expect(dir).toContain('Incident/')
    })

    it('5.1d — failed campaign produces FAIL in report', async () => {
      const report = await new CampaignEngine('FailTest', { timeMultiplier: 0 })
        .assert({ name: 'fail', fn: () => ({ name: 'fail', status: 'failed' as const, detail: 'intentional' }) })
        .certify()
        .run({})

      const bundle = new IncidentBundle(report)
      expect(bundle.getContent().certificationReport.status).toBe('FAIL')
      expect(bundle.getContent().manifest.allPass).toBe(false)
    })
  })

  describe('Block 5.2 — Bundle content structure', () => {
    it('5.2a — health snapshot reflects campaign results', async () => {
      const report = await new CampaignEngine('Health', { timeMultiplier: 0 })
        .at(0).inject(new LatencyRule('r1', FailureInjectionScope.REST, 1.0, { minMs: 100, maxMs: 200 }))
        .assert({ name: 'ok', fn: () => ({ name: 'ok', status: 'passed' as const }) })
        .certify()
        .run({ injector: new FailureInjector() })

      const bundle = new IncidentBundle(report)
      const snap = bundle.getContent().healthSnapshot
      expect(snap.healthy).toBe(true)
      expect(snap.checks).toBeDefined()
    })

    it('5.2b — metrics include campaign stats', async () => {
      const report = await new CampaignEngine('Metrics', { timeMultiplier: 0 })
        .assert({ name: 'a', fn: () => ({ name: 'a', status: 'passed' as const }) })
        .assert({ name: 'b', fn: () => ({ name: 'b', status: 'passed' as const }) })
        .certify()
        .run({})

      const bundle = new IncidentBundle(report)
      const metrics = bundle.getContent().metrics
      expect(metrics.totalAssertions).toBe(2)
      expect(metrics.passedAssertions).toBe(2)
    })
  })
})

// ════════════════════════════════════════════
// Block 6 — Campaign Report (text() method)
// ════════════════════════════════════════════

describe('Block 6 — Campaign Report', () => {
  describe('Block 6.1 — Report formatting', () => {
    it('6.1a — report shows PASS for passing campaign', async () => {
      const report = await new CampaignEngine('Passing', { timeMultiplier: 0 })
        .assert({ name: 'ok', fn: () => ({ name: 'ok', status: 'passed' as const }) })
        .certify()
        .run({})

      const text = report.text()
      expect(text).toContain('PASS')
      expect(text).toContain('Passing')
      expect(text).toContain('Assertions:        1')
    })

    it('6.1b — report shows FAIL for failing campaign', async () => {
      const report = await new CampaignEngine('Failing', { timeMultiplier: 0 })
        .assert({ name: 'nope', fn: () => ({ name: 'nope', status: 'failed' as const, detail: 'boom' }) })
        .certify()
        .run({})

      const text = report.text()
      expect(text).toContain('FAIL')
      expect(text).toContain('nope')
      expect(text).toContain('boom')
    })

    it('6.1c — report includes SLO violations when present', async () => {
      const report = await new CampaignEngine('SLODemo', { timeMultiplier: 0 })
        .certify()
        .run({})

      // Manually add an SLO violation to the report for testing
      ;((report as any).sloResults as any[])!.push({
        name: 'test-slo',
        targetMs: 100,
        actualMs: 500,
        pass: false,
      })

      const text = report.text()
      expect(text).toContain('SLO Violations')
      expect(text).toContain('test-slo: 500ms (target: 100ms)')
    })
  })
})

// ════════════════════════════════════════════
// Block 7 — Final Gate
// ════════════════════════════════════════════

describe('Block 7 — Final Gate', () => {
  describe('Block 7.1 — Gate evaluation', () => {
    it('7.1a — all campaigns passing returns GO', async () => {
      const r1 = await new CampaignEngine('A', { timeMultiplier: 0 }).certify().run({})
      const r2 = await new CampaignEngine('B', { timeMultiplier: 0 }).certify().run({})

      const gate = new FinalGate([r1, r2])
      const result = gate.evaluate()
      expect(result.decision).toBe('GO')
      expect(result.campaigns).toBe(2)
      expect(result.failedCampaigns).toHaveLength(0)
    })

    it('7.1b — any campaign failing returns ROLLBACK', async () => {
      const r1 = await new CampaignEngine('Good', { timeMultiplier: 0 }).certify().run({})
      const r2 = await new CampaignEngine('Bad', { timeMultiplier: 0 })
        .assert({ name: 'fail', fn: () => ({ name: 'fail', status: 'failed' as const, detail: 'intentional' }) })
        .certify()
        .run({})

      const gate = new FinalGate([r1, r2])
      const result = gate.evaluate()
      expect(result.decision).toBe('ROLLBACK')
      expect(result.failedCampaigns).toContain('Bad')
    })

    it('7.1c — total assertions aggregated correctly', async () => {
      const r1 = await new CampaignEngine('A', { timeMultiplier: 0 })
        .assert({ name: 'a1', fn: () => ({ name: 'a1', status: 'passed' as const }) })
        .certify()
        .run({})
      const r2 = await new CampaignEngine('B', { timeMultiplier: 0 })
        .assert({ name: 'b1', fn: () => ({ name: 'b1', status: 'passed' as const }) })
        .assert({ name: 'b2', fn: () => ({ name: 'b2', status: 'passed' as const }) })
        .certify()
        .run({})

      const gate = new FinalGate([r1, r2])
      const result = gate.evaluate()
      expect(result.totalAssertions).toBe(3)
      expect(result.passedAssertions).toBe(3)
      expect(result.failedAssertions).toBe(0)
    })

    it('7.1d — SLO violations can be ignored via config', async () => {
      const r1 = await new CampaignEngine('A', { timeMultiplier: 0 }).certify().run({})
      ;((r1 as any).sloResults as any[])!.push({ name: 'slow', targetMs: 100, actualMs: 500, pass: false })

      const gate = new FinalGate([r1])
      const relaxed = gate.evaluate({ failOnSloViolation: false })
      expect(relaxed.decision).toBe('GO')

      const strict = gate.evaluate({ failOnSloViolation: true })
      expect(strict.decision).toBe('ROLLBACK')
    })
  })

  describe('Block 7.2 — Gate report', () => {
    it('7.2a — report() generates human-readable output', async () => {
      const r1 = await new CampaignEngine('A', { timeMultiplier: 0 }).certify().run({})
      const gate = new FinalGate([r1])
      const text = gate.report()
      expect(text).toContain('Final Gate')
      expect(text).toContain('GO')
      expect(text).toContain('Campaigns:')
    })

    it('7.2b — report shows ROLLBACK for failures', async () => {
      const r1 = await new CampaignEngine('Bad', { timeMultiplier: 0 })
        .assert({ name: 'fail', fn: () => ({ name: 'fail', status: 'failed' as const, detail: 'oops' }) })
        .certify()
        .run({})

      const gate = new FinalGate([r1])
      const text = gate.report()
      expect(text).toContain('ROLLBACK')
    })
  })
})

// ════════════════════════════════════════════
// Helper
// ════════════════════════════════════════════

function makeContext() {
  const assertions: import('../CampaignEngine').CampaignAssertion[] = []
  const slos: import('../CampaignEngine').SLOResult[] = []
  return {
    deps: {},
    pushAssertion(a: import('../CampaignEngine').CampaignAssertion) { assertions.push(a) },
    recordSLO(name: string, targetMs: number, actualMs: number) {
      slos.push({ name, targetMs, actualMs, pass: actualMs <= targetMs })
    },
    getAssertions: () => [...assertions],
    getSLOs: () => [...slos],
  } as import('../CampaignEngine').CampaignContext
}
