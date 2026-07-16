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
export type { BrokerAdapter, BrokerEventHandler } from './BrokerAdapter'

// Capabilities
export type { BrokerCapabilities } from './BrokerCapabilities'
export {
  NO_CAPABILITIES,
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

// Main Provider
export { LiveProvider } from './LiveProvider'

// LiveProviderConfig
export type { LiveProviderConfig } from './types'
