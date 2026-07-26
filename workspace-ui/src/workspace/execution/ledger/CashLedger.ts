// ── CashLedger — Cash balance tracking ──
//
// Tracks cash in multiple assets (USDT, BTC, etc.).
//
// @since 3.5.1

import type { CashBalance, Fill } from '../types'

export class CashLedger {
  private balances: Map<string, CashBalance> = new Map()

  constructor(initialBalances: { asset: string; amount: number }[] = []) {
    for (const { asset, amount } of initialBalances) {
      this.setBalance(asset, amount)
    }
  }

  /** Seed or reset a balance (used by ExecutionRuntime.initialize) */
  seed(asset: string, amount: number): void {
    this.balances.clear()
    this.setBalance(asset, amount)
  }

  /** Add to existing balance without clearing — for additional asset seeds */
  addBalance(asset: string, amount: number): void {
    const existing = this.balances.get(asset)
    if (existing) {
      this.balances.set(asset, {
        ...existing,
        free: existing.free + amount,
        total: existing.total + amount,
      })
    } else {
      this.setBalance(asset, amount)
    }
  }

  /** Get balance for an asset */
  get(asset: string): CashBalance {
    return this.balances.get(asset) ?? { asset, free: 0, locked: 0, total: 0 }
  }

  /** All balances */
  all(): CashBalance[] {
    return Array.from(this.balances.values())
  }

  /** Process a fill: debit quote, credit base */
  applyFill(fill: Fill): void {
    if (fill.side === 'buy') {
      // Debit quote currency (cost + commission), credit base
      this.debit(fill.commissionAsset, fill.price * fill.quantity + fill.commission)
      this.credit(fill.symbol, fill.quantity)
    } else {
      // Debit base, credit quote currency (proceeds - commission)
      this.debit(fill.symbol, fill.quantity)
      this.credit(fill.commissionAsset, fill.price * fill.quantity - fill.commission)
    }
  }

  /** Cash available for spending */
  free(asset: string): number {
    return this.get(asset).free
  }

  /** Total cash balance */
  total(asset: string): number {
    return this.get(asset).total
  }

  /** Reset to initial state */
  clear(): void {
    this.balances.clear()
  }

  // ── Internal ──

  private credit(asset: string, amount: number): void {
    const balance = this.get(asset)
    this.balances.set(asset, {
      ...balance,
      free: balance.free + amount,
      total: balance.total + amount,
    })
  }

  private debit(asset: string, amount: number): void {
    const balance = this.get(asset)
    if (balance.free < amount) {
      throw new Error(`Insufficient ${asset}: have ${balance.free}, need ${amount}`)
    }
    this.balances.set(asset, {
      ...balance,
      free: balance.free - amount,
      locked: balance.locked,
      total: balance.total - amount,
    })
  }

  private setBalance(asset: string, amount: number): void {
    this.balances.set(asset, {
      asset,
      free: amount,
      locked: 0,
      total: amount,
    })
  }
}
