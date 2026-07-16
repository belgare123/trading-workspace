/**
 * live/index.ts — Barrel exports for Live Provider
 *
 * @since 4.5
 */

// Types
export type * from './types'
export {
  ConnectionStates,
  canTransition,
  DEFAULT_LIVE_CONFIG,
} from './types'

// Broker Adapter interface
export type { BrokerAdapter } from './BrokerAdapter'

// Capabilities
export type { BrokerCapabilities } from './BrokerCapabilities'
export {
  NO_CAPABILITIES,
  MOCK_CAPABILITIES,
  BINANCE_SPOT_CAPABILITIES,
  BINANCE_FUTURES_CAPABILITIES,
  BYBIT_CAPABILITIES,
} from './BrokerCapabilities'

// Session
export { BrokerSession } from './BrokerSession'
export type { SessionListener } from './BrokerSession'

// Order Router
export { OrderRouter } from './OrderRouter'

// Position Synchronizer
export { PositionSynchronizer } from './PositionSynchronizer'

// Account Synchronizer
export { AccountSynchronizer } from './AccountSynchronizer'

// Event Adapter
export { BrokerEventAdapter } from './BrokerEventAdapter'

// ── Execution Infrastructure Core (Sprint 4.6.1) ──

export { RetryPolicy } from './RetryPolicy'
export type { RetryPolicyConfig, RetryStrategy, RetryDecision } from './RetryPolicy'

export { BrokerClock } from './BrokerClock'
export type { BrokerClockConfig } from './BrokerClock'

export { RateLimiter, RateLimitExceeded } from './RateLimiter'
export type { RateLimitConfig, OperationType } from './RateLimiter'

// ── Order State Reconciler (Sprint 4.6.2) ──

export { OrderStateReconciler } from './OrderStateReconciler'
export type { ReconciliationIssue, ReconciliationResult, ReconciliationSeverity, LocalStateProvider } from './OrderStateReconciler'

// ── Secrets Provider (Sprint 4.6.4) ──

export { SecretsProvider, SecretKeys, EnvSecretStore, MemorySecretStore, SecretNotFound } from './SecretsProvider'
export type { SecretStore, SecretsProviderConfig } from './SecretsProvider'

// ── Execution Recovery Runtime (Sprint 4.6.6) ──

export { ExecutionRecoveryRuntime } from './ExecutionRecoveryRuntime'
export type { RecoveryConfig, RecoveryReport, RecoveryPhase, RecoveryMode, RecoveryEvent } from './ExecutionRecoveryRuntime'

// Main Provider
export { LiveProvider } from './LiveProvider'

// LiveProviderConfig
export type { LiveProviderConfig } from './types'
