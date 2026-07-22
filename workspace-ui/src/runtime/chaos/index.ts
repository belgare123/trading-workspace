/**
 * chaos/index.ts — Barrel exports for Chaos Runtime
 *
 * @since 6.6
 */

// Core
export { FailureInjector } from './FailureInjector'
export type { ChaosEvent, ChaosEventHandler } from './FailureInjector'

// Noop
export { NoopFailureInjector } from './NoopFailureInjector'

// Observer
export {
  NoopFailureObserver,
  CompositeFailureObserver,
} from './IFailureObserver'
export type { IFailureObserver, FailureObservation } from './IFailureObserver'

// Rules
export {
  FailureInjectionScope,
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
export type {
  InjectionRule,
  InjectionContext,
  FailureContext,
  InjectionAction,
} from './InjectionRule'
export type {
  LatencyRuleParams,
  TimeoutRuleParams,
  DisconnectRuleParams,
  ReconnectRuleParams,
  PacketLossRuleParams,
  PartialResponseRuleParams,
  MalformedResponseRuleParams,
  ConnectionRefusedRuleParams,
  RateLimitRuleParams,
} from './InjectionRule'

// Profiles
export {
  BUILTIN_PROFILES,
  NORMAL_PROFILE,
  EXCHANGE_SLOW_PROFILE,
  EXCHANGE_FLAKY_PROFILE,
  NETWORK_LOSS_PROFILE,
  RANDOM_CHAOS_PROFILE,
} from './FailureProfile'
export type { FailureProfile } from './FailureProfile'

// Scenarios
export { ScenarioBuilder } from './FailureScenario'
export type { FailureScenario, ScenarioStep, ScenarioAction } from './FailureScenario'

// Random
export { SeededRandom } from './SeededRandom'
export type { RandomSource } from './RandomSource'

// Wrappers
export { wrapFetch } from './WrappedFetch'
export { WrappedWebSocket } from './WrappedWebSocket'
export type { CategoryClassifier } from './WrappedWebSocket'

// Private WS Classifier (6.6.4)
export { createBybitCategoryClassifier } from './privateWsClassifier'

// WebSocket Factory (6.6.3a)
export { NativeWebSocketFactory, ChaosWebSocketFactory } from './WebSocketFactory'
export type { IWebSocketFactory } from './WebSocketFactory'

// Chaos Trace (6.6.2a)
export { ChaosTraceRuntime } from './ChaosTraceRuntime'
export type { ChaosTraceRuntimeOptions, ChaosTraceRuntimeStats, ChaosTraceExport } from './ChaosTraceRuntime'
export { ChaosTraceMetrics } from './ChaosTraceMetrics'
export type { ChaosTraceMetricsSnapshot } from './ChaosTraceMetrics'
export { ChaosTraceHealth } from './ChaosTraceHealth'
export type { ChaosTraceHealthResult } from './ChaosTraceHealth'
export {
  TraceEventJournal,
  nextChaosTraceId,
  computeSeverity,
} from './ChaosTrace'
export type {
  ChaosTrace,
  ChaosTraceEvent,
  ChaosTraceStatus,
  ChaosTracePhase,
  ChaosTraceSeverity,
} from './ChaosTrace'
