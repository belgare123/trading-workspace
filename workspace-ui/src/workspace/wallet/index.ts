// ── Wallet: barrel ──
// Sprint 5.6 — WalletManager

export { Wallet } from './Wallet'
export { WalletManager, IWalletManager } from './runtime/WalletManager'
export { WalletSynchronizer } from './runtime/WalletSynchronizer'
export type { IWalletGateway } from './runtime/WalletSynchronizer'
export { WalletEventBus } from './events/WalletEventBus'
export { FixedAmountAllocator } from './allocation/FixedAmountAllocator'
export { FixedPercentAllocator } from './allocation/FixedPercentAllocator'
export { RiskPercentAllocator } from './allocation/RiskPercentAllocator'
export { KellyAllocator } from './allocation/KellyAllocator'
export * from './types'
