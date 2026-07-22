// ── WalletManager — single source of truth for capital ──
// Sprint 5.6 — WalletManager

import { Wallet } from '../Wallet'
import { WalletEventBus } from '../events/WalletEventBus'
import type {
  Balance, WalletSnapshot, AllocationRequest, AllocationResult,
  AllocationPolicy, AllocatorConfig, IWalletManager,
  WalletEvent, WalletEventHandler,
} from '../types'
import type { Trade } from '../../trade/Trade'

export { IWalletManager } from '../types'

/**
 * WalletManager — владелец капитала.
 *
 * Обязанности:
 * - Единственная точка правды для баланса
 * - Position sizing через AllocationPolicy
 * - Резервирование и освобождение средств
 * - Синхронизация с биржей
 * - События wallet:*
 */
export class WalletManager implements IWalletManager {
  readonly wallet: Wallet
  readonly eventBus: WalletEventBus
  private readonly allocator: AllocationPolicy | null

  constructor(config?: {
    initialBalance?: Partial<Balance>
    allocator?: AllocationPolicy | null
  }) {
    this.wallet = new Wallet(config?.initialBalance)
    this.eventBus = new WalletEventBus()
    this.allocator = config?.allocator ?? null
    // Bridge wallet events → eventBus
    this.wallet.on('wallet:reserved', (e) => this.eventBus.emit(e))
    this.wallet.on('wallet:released', (e) => this.eventBus.emit(e))
    this.wallet.on('wallet:committed', (e) => this.eventBus.emit(e))
    this.wallet.on('wallet:balance-updated', (e) => this.eventBus.emit(e))
    this.wallet.on('wallet:equity-changed', (e) => this.eventBus.emit(e))
    this.wallet.on('wallet:margin-updated', (e) => this.eventBus.emit(e))
  }

  getBalance(): Balance {
    return { ...this.wallet.balance }
  }

  getSnapshot(): WalletSnapshot {
    return this.wallet.getSnapshot()
  }

  allocate(request: AllocationRequest): AllocationResult {
    const balance = this.wallet.balance
    if (!this.allocator) {
      throw new Error('WalletManager: no allocator configured')
    }
    const result = this.allocator.allocate(request, balance)

    // Validate sufficient balance
    if (result.notionalValue > balance.total) {
      throw new Error(`Insufficient equity: need ${result.notionalValue.toFixed(2)}, have ${balance.total.toFixed(2)}`)
    }

    this.eventBus.emit({ type: 'wallet:allocated', result, timestamp: Date.now() })
    return result
  }

  reserve(amount: number, orderId: string): void {
    this.wallet.reserve(amount, orderId)
  }

  release(orderId: string): void {
    this.wallet.release(orderId)
  }

  commit(trade: Trade): void {
    this.wallet.commit(trade)
  }

  sync(balance: Balance): void {
    this.wallet.sync(balance)
  }

  updatePositions(count: number, unrealizedPnL: number): void {
    this.wallet.updatePositions(count, unrealizedPnL)
  }

  on(eventType: string, handler: WalletEventHandler): () => void {
    return this.eventBus.on(eventType, handler)
  }

  shutdown(): void {
    this.wallet.shutdown()
    this.eventBus.clear()
  }
}
