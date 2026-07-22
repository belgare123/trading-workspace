// ── FixedAmountAllocator — allocate fixed quantity ──
// Sprint 5.6 — WalletManager

import type { AllocationPolicy, AllocationRequest, AllocationResult, Balance } from '../types'

export class FixedAmountAllocator implements AllocationPolicy {
  readonly id = 'fixed-amount'
  private readonly amount: number

  constructor(config: { amount: number }) {
    if (config.amount <= 0) throw new Error('FixedAmountAllocator: amount must be positive')
    this.amount = config.amount
  }

  allocate(request: AllocationRequest, balance: Balance): AllocationResult {
    const notionalValue = this.amount * request.price
    const pctOfEquity = balance.total > 0 ? notionalValue / balance.total : 0

    return {
      quantity: this.amount,
      notionalValue,
      riskAmount: 0,
      riskPct: 0,
      pctOfEquity,
      method: `fixed-${this.amount}`,
    }
  }
}
