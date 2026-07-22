// ── WalletSynchronizer — sync balance from exchange via Gateway ──
// Sprint 5.6 — WalletManager

import type { Balance, WalletSynchronizerConfig } from '../types'
import type { IWalletManager } from '../types'

/** Minimal Gateway interface for wallet sync */
export interface IWalletGateway {
  getBalance(): Promise<Balance>
}

/**
 * WalletSynchronizer — polls Gateway for balance and pushes to WalletManager.
 */
export class WalletSynchronizer {
  private readonly walletManager: IWalletManager
  private readonly gateway: IWalletGateway
  private readonly config: WalletSynchronizerConfig
  private _timer: ReturnType<typeof setInterval> | null = null
  private _retries = 0
  private _running = false

  constructor(
    walletManager: IWalletManager,
    gateway: IWalletGateway,
    config?: Partial<WalletSynchronizerConfig>,
  ) {
    this.walletManager = walletManager
    this.gateway = gateway
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? 15_000,
      maxRetries: config?.maxRetries ?? 3,
    }
  }

  get isRunning(): boolean {
    return this._running
  }

  async start(): Promise<void> {
    if (this._running) return
    this._running = true
    // Initial sync
    await this.syncOnce()
    // Periodic sync
    this._timer = setInterval(() => { this.syncOnce() }, this.config.pollIntervalMs)
  }

  stop(): void {
    this._running = false
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  async syncOnce(): Promise<boolean> {
    try {
      const balance = await this.gateway.getBalance()
      this.walletManager.sync(balance)
      this._retries = 0
      return true
    } catch (err) {
      this._retries++
      if (this._retries >= this.config.maxRetries) {
        this.stop()
        throw new Error(`WalletSynchronizer: max retries (${this.config.maxRetries}) exceeded`)
      }
      return false
    }
  }
}
