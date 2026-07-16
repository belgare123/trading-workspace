/**
 * index.ts — Live Trading Platform barrel export
 *
 * @since 4.1
 */

// ── Gateway ──

export { ExecutionMode } from './gateway/ExecutionMode'
export type { ExecutionMode as ExecutionModeType } from './gateway/ExecutionMode'
export {
  EXECUTION_MODE_LABELS,
  EXECUTION_MODE_COLORS,
} from './gateway/ExecutionMode'

export type {
  ExecutionGateway,
  GatewayConfig,
  GatewayStatus,
  AccountInfo,
  OrderResult,
} from './gateway/ExecutionGateway'

export { GatewayRuntime, gatewayRuntime } from './gateway/GatewayRuntime'
export { gatewayRegistry } from './gateway/GatewayRegistry'
export type { GatewayFactory } from './gateway/GatewayRegistry'

// ── Providers ──

export { BacktestProvider } from './providers/BacktestProvider'
export { PaperProvider } from './providers/PaperProvider'
export { LiveProvider } from './providers/LiveProvider'
