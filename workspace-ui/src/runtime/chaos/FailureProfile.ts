/**
 * FailureProfile.ts — Named collection of injection rules
 *
 * Profiles are the user-facing configuration primitive.
 * A profile bundles rules with a scope and probability configuration.
 * The FailureInjector.setProfile(profile) atomically swaps the full rule set.
 *
 * Built-in profiles: Normal, ExchangeSlow, ExchangeFlaky, NetworkLoss, RandomChaos
 *
 * @since 6.6
 */

import { FailureInjectionScope } from './InjectionRule'
import type { InjectionRule } from './InjectionRule'
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
} from './InjectionRule'

export interface FailureProfile {
  readonly id: string
  readonly description: string
  readonly rules: InjectionRule[]
}

// ════════════════════════════════════════════
// Built-in profiles
// ════════════════════════════════════════════

export const NORMAL_PROFILE: FailureProfile = {
  id: 'normal',
  description: 'No faults injected — baseline verification',
  rules: [],
}

export const EXCHANGE_SLOW_PROFILE: FailureProfile = {
  id: 'exchange-slow',
  description: 'Simulate slow exchange: 2-5s latency on 30% of requests',
  rules: [
    new LatencyRule('slow-latency-rest', FailureInjectionScope.REST, 1.0, { minMs: 2000, maxMs: 5000 }),
    new LatencyRule('slow-latency-priv-ws', FailureInjectionScope.PRIVATE_WS, 0.3, { minMs: 1000, maxMs: 3000 }),
  ],
}

export const EXCHANGE_FLAKY_PROFILE: FailureProfile = {
  id: 'exchange-flaky',
  description: 'Simulate flaky exchange: latency + timeout + partial + reconnect cycles',
  rules: [
    new LatencyRule('flaky-latency', FailureInjectionScope.REST, 0.5, { minMs: 1000, maxMs: 8000 }),
    new TimeoutRule('flaky-timeout', FailureInjectionScope.REST, 0.1, { durationMs: 10000 }),
    new PartialResponseRule('flaky-partial', FailureInjectionScope.REST, 0.05, { size: 50 }),
    new MalformedResponseRule('flaky-malformed', FailureInjectionScope.REST, 0.03),
    new ReconnectRule('flaky-reconnect-ws', FailureInjectionScope.PRIVATE_WS, 0.2, { delayMs: 2000 }),
    new ReconnectRule('flaky-reconnect-pub-ws', FailureInjectionScope.PUBLIC_WS, 0.15, { delayMs: 1000 }),
  ],
}

export const NETWORK_LOSS_PROFILE: FailureProfile = {
  id: 'network-loss',
  description: 'Simulate unreliable network: packet loss + disconnects every ~60s',
  rules: [
    new PacketLossRule('netloss-pkt-rest', FailureInjectionScope.REST, 1.0, { lossRate: 0.15 }),
    new PacketLossRule('netloss-pkt-ws', FailureInjectionScope.PRIVATE_WS, 1.0, { lossRate: 0.25 }),
    new DisconnectRule('netloss-dc-ws', FailureInjectionScope.PRIVATE_WS, 0.05),
    new DisconnectRule('netloss-dc-pub-ws', FailureInjectionScope.PUBLIC_WS, 0.03),
    new ReconnectRule('netloss-recon', FailureInjectionScope.GLOBAL, 0.02, { delayMs: 3000 }),
    new TimeoutRule('netloss-timeout', FailureInjectionScope.REST, 0.15, { durationMs: 15000 }),
  ],
}

export const RANDOM_CHAOS_PROFILE: FailureProfile = {
  id: 'random-chaos',
  description: 'Random selection from all failure modes — use with seed for reproducibility',
  rules: [
    new LatencyRule('rand-latency', FailureInjectionScope.GLOBAL, 0.4, { minMs: 100, maxMs: 10000 }),
    new TimeoutRule('rand-timeout', FailureInjectionScope.GLOBAL, 0.1, { durationMs: 20000 }),
    new DisconnectRule('rand-dc', FailureInjectionScope.GLOBAL, 0.05),
    new ReconnectRule('rand-recon', FailureInjectionScope.GLOBAL, 0.05, { delayMs: 1000 }),
    new PacketLossRule('rand-pkt', FailureInjectionScope.GLOBAL, 0.3, { lossRate: 0.5 }),
    new PartialResponseRule('rand-partial', FailureInjectionScope.REST, 0.1, { size: 20 }),
    new MalformedResponseRule('rand-malformed', FailureInjectionScope.REST, 0.05),
    new ConnectionRefusedRule('rand-refused', FailureInjectionScope.REST, 0.03),
    new RateLimitRule('rand-ratelimit', FailureInjectionScope.REST, 0.08, { retryAfterMs: 5000 }),
  ],
}

/** Built-in profile registry by id */
export const BUILTIN_PROFILES: Record<string, FailureProfile> = {
  normal: NORMAL_PROFILE,
  'exchange-slow': EXCHANGE_SLOW_PROFILE,
  'exchange-flaky': EXCHANGE_FLAKY_PROFILE,
  'network-loss': NETWORK_LOSS_PROFILE,
  'random-chaos': RANDOM_CHAOS_PROFILE,
}
