// ── FixedPercentAllocator — allocate % of equity ──
// Sprint 5.6 — WalletManager

import type { AllocationPolicy, AllocationRequest, AllocationResult, Balance } from '../types'

export class FixedPercentAllocator implements AllocationPolicy {
  readonly id = 'fixed-percent'
  private readonly percent: number
  private readonly maxLeverage: number

  constructor(config: { percent: number; maxLeverage?: number }) {
    if (config.percent <= 0 || config.percent > 1) {
      throw new Error('FixedPercentAllocator: percent must be in (0, 1]')
    }
    this.percent = config.percent
    this.maxLeverage = config.maxLeverage ?? 1
  }

  allocate(request: AllocationRequest, balance: Balance): AllocationResult {
    const allocatedEquity = balance.total * this.percent * this.maxLeverage
    const quantity = allocatedEquity / request.price
    const riskAmount = 0
    const riskPct = 0

    return {
      quantity,
      notionalValue: quantity * request.price,
      riskAmount,
      riskPct,
      pctOfEquity: this.percent * this.maxLeverage,
      method: `fixed-${(this.percent * 100).toFixed(1)}%`,
    }
  }
}
