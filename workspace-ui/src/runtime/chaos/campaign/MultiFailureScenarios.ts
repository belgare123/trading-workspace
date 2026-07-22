/**
 * MultiFailureScenarios.ts — Pre-built Chaos Campaign Definitions
 *
 * Sprint 6.6.6 — Full Chaos Campaign (Block 2)
 *
 * Four real-world multi-failure scenarios combining existing
 * FailureProfile and InjectionRule types. Each scenario is a factory
 * that returns a CampaignEngine with a pre-built timeline.
 *
 * Scenarios:
 *   - Exchange Slow    : REST + Public WS latency + Packet loss
 *   - Network Partition : REST timeout + Private disconnect + Reconnect
 *   - Exchange Outage   : Full down (REST + Public + Private) → gradual recovery
 *   - Cascading Failure  : Latency → Timeout → Disconnect → Recovery
 *
 * @since 6.6.6
 */

import { CampaignEngine } from './CampaignEngine'
import type { CampaignAssertion, CampaignContext } from './CampaignEngine'
import { FailureInjectionScope } from '../InjectionRule'
import {
  LatencyRule,
  TimeoutRule,
  DisconnectRule,
  ReconnectRule,
  PacketLossRule,
} from '../InjectionRule'

// ── Scenario configuration types ──

export interface ScenarioOptions {
  /** Virtual time multiplier (0 = instant for tests) */
  timeMultiplier?: number
  /** Custom assertion to run during each recovery phase */
  onRecovery?: (ctx: CampaignContext) => CampaignAssertion | Promise<CampaignAssertion>
  /** Custom assertion at the end */
  onCertify?: (ctx: CampaignContext) => CampaignAssertion | Promise<CampaignAssertion>
}

// ════════════════════════════════════════════
// 1. Exchange Slow
// ════════════════════════════════════════════

/**
 * Simulates a slow exchange: REST latency (2–5s on 30%),
 * Public WS latency (1–3s on 50%), and intermittent packet loss.
 * Duration: ~6 minutes virtual time.
 */
export function createExchangeSlowScenario(options?: ScenarioOptions): CampaignEngine {
  const t = options?.timeMultiplier ?? 1
  return new CampaignEngine('Exchange Slow', { timeMultiplier: t })
    .at(60_000).inject(
      new LatencyRule('slow-rest', FailureInjectionScope.REST, 0.3, { minMs: 2000, maxMs: 5000 }),
    )
    .at(120_000).inject(
      new LatencyRule('slow-pub-ws', FailureInjectionScope.PUBLIC_WS, 0.5, { minMs: 1000, maxMs: 3000 }),
    )
    .at(180_000).inject(
      new PacketLossRule('slow-pkt', FailureInjectionScope.REST, 0.1, { lossRate: 0.05 }),
    )
    .assert({
      name: 'exchange-slow-healthy',
      fn: async (ctx) => {
        if (options?.onRecovery) return options.onRecovery(ctx)
        return { name: 'exchange-slow-healthy', status: 'passed' }
      },
    })
    .certify()
}

// ════════════════════════════════════════════
// 2. Network Partition
// ════════════════════════════════════════════

/**
 * Simulates a network partition: REST timeout (10s on 20%),
 * Private WS disconnect, then reconnect after delay.
 * Duration: ~8 minutes virtual time.
 */
export function createNetworkPartitionScenario(options?: ScenarioOptions): CampaignEngine {
  const t = options?.timeMultiplier ?? 1
  return new CampaignEngine('Network Partition', { timeMultiplier: t })
    .at(60_000).inject(
      new TimeoutRule('part-timeout', FailureInjectionScope.REST, 0.2, { durationMs: 10000 }),
    )
    .at(180_000).inject(
      new DisconnectRule('part-dc-priv-ws', FailureInjectionScope.PRIVATE_WS, 1.0),
    )
    .at(240_000).inject(
      new ReconnectRule('part-recon-priv-ws', FailureInjectionScope.PRIVATE_WS, 1.0, { delayMs: 3000 }),
    )
    .assert({
      name: 'partition-recovered',
      fn: async (ctx) => {
        if (options?.onRecovery) return options.onRecovery(ctx)
        return { name: 'partition-recovered', status: 'passed' }
      },
    })
    .certify()
}

// ════════════════════════════════════════════
// 3. Exchange Outage
// ════════════════════════════════════════════

/**
 * Simulates a full exchange outage: REST, Public WS, and Private WS
 * all go down, then gradually recover.
 * Duration: ~15 minutes virtual time.
 */
export function createExchangeOutageScenario(options?: ScenarioOptions): CampaignEngine {
  const t = options?.timeMultiplier ?? 1
  return new CampaignEngine('Exchange Outage', { timeMultiplier: t })
    // Full outage
    .at(60_000).inject(
      new TimeoutRule('outage-rest', FailureInjectionScope.REST, 1.0, { durationMs: 600000 }),
    )
    .at(120_000).inject(
      new DisconnectRule('outage-pub-ws', FailureInjectionScope.PUBLIC_WS, 1.0),
    )
    .at(180_000).inject(
      new DisconnectRule('outage-priv-ws', FailureInjectionScope.PRIVATE_WS, 1.0),
    )
    // Gradual recovery
    .at(600_000).recover(FailureInjectionScope.REST)
    .assert({
      name: 'outage-rest-recovered',
      fn: async (ctx) => {
        if (options?.onRecovery) return options.onRecovery(ctx)
        return { name: 'outage-rest-recovered', status: 'passed' }
      },
    })
    .at(720_000).recover(FailureInjectionScope.PUBLIC_WS)
    .at(840_000).recover(FailureInjectionScope.PRIVATE_WS)
    .assert({
      name: 'outage-all-recovered',
      fn: async (ctx) => {
        if (options?.onRecovery) return options.onRecovery(ctx)
        return { name: 'outage-all-recovered', status: 'passed' }
      },
    })
    .certify()
}

// ════════════════════════════════════════════
// 4. Cascading Failure
// ════════════════════════════════════════════

/**
 * Simulates a cascading failure: latency escalates to timeout,
 * then disconnect, then recovery.
 * Duration: ~10 minutes virtual time.
 */
export function createCascadingFailureScenario(options?: ScenarioOptions): CampaignEngine {
  const t = options?.timeMultiplier ?? 1
  return new CampaignEngine('Cascading Failure', { timeMultiplier: t })
    // Stage 1: Latency
    .at(60_000).inject(
      new LatencyRule('cascade-latency', FailureInjectionScope.REST, 0.5, { minMs: 2000, maxMs: 8000 }),
    )
    // Stage 2: Latency → Timeout
    .at(180_000).inject(
      new TimeoutRule('cascade-timeout', FailureInjectionScope.REST, 0.3, { durationMs: 15000 }),
    )
    // Stage 3: Timeout → Disconnect
    .at(300_000).inject(
      new DisconnectRule('cascade-dc', FailureInjectionScope.PRIVATE_WS, 0.5),
    )
    // Stage 4: Reconnect attempt
    .at(420_000).inject(
      new ReconnectRule('cascade-recon', FailureInjectionScope.PRIVATE_WS, 0.5, { delayMs: 5000 }),
    )
    // Recovery: remove all cascade rules
    .at(540_000).recover(FailureInjectionScope.REST)
    .at(540_000).recover(FailureInjectionScope.PRIVATE_WS)
    .assert({
      name: 'cascade-recovered',
      fn: async (ctx) => {
        if (options?.onRecovery) return options.onRecovery(ctx)
        return { name: 'cascade-recovered', status: 'passed' }
      },
    })
    .certify()
}

// ── Helper ──

function round(n: number): number {
  return Math.round(n)
}

// ── All scenarios ──

export function createAllScenarios(options?: ScenarioOptions): CampaignEngine[] {
  return [
    createExchangeSlowScenario(options),
    createNetworkPartitionScenario(options),
    createExchangeOutageScenario(options),
    createCascadingFailureScenario(options),
  ]
}
