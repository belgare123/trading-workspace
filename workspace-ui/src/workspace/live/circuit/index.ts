/**
 * Circuit Breaker — barrel exports
 *
 * Usage:
 *   import { CircuitBreaker, CircuitBreakerFSM } from '../circuit'
 *   import { DegradationManager } from '../circuit'
 *
 * @since 6.2.0
 */

export { CircuitBreakerFSM } from './CircuitBreakerFSM'
export type { CircuitState, StateTransition, FSMConfig } from './CircuitBreakerFSM'

export { CircuitBreaker } from './CircuitBreaker'
export type {
  ErrorCategory,
  CircuitBreakerConfig,
  CircuitBreakerSnapshot,
  ProbeResult,
  FailureRecord,
} from './CircuitBreaker'

export { DegradationManager } from './DegradationManager'
export type {
  DegradationEvent,
  DegradationListener,
  DegradationReason,
  LifecycleActions,
} from './DegradationManager'

export { GatewayCircuitBreaker } from './GatewayCircuitBreaker'
