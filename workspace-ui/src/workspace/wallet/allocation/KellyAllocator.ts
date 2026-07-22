// ── KellyAllocator — Kelly Criterion position sizing ──
// Sprint 5.6 — WalletManager

import type { AllocationPolicy, AllocationRequest, AllocationResult, Balance } from '../types'

/**
 * KellyAllocator uses the Kelly Criterion to size positions.
 *   f* = (p × b - q) / b
 *   where p = winRate, q = 1-p, b = avgRiskReward (win/loss ratio)
 *
 * Defaults: conservative quarter-Kelly (fraction = 0.25) for live trading.
 */
export class KellyAllocator implements AllocationPolicy {
  readonly id = 'kelly'
  private readonly fraction: number
  private readonly winRate: number
  private readonly avgRiskReward: number

  constructor(config: { fraction: number; winRate?: number; avgRiskReward?: number }) {
    this.fraction = config.fraction
    this.winRate = config.winRate ?? 0.5
    this.avgRiskReward = config.avgRiskReward ?? 1.5

    if (this.winRate <= 0 || this.winRate >= 1) {
      this.winRate = 0.5
    }
  }

  allocate(request: AllocationRequest, balance: Balance): AllocationResult {
    // Kelly % = (p * b - q) / b
    const q = 1 - this.winRate
    const kellyPct = (this.winRate * this.avgRiskReward - q) / this.avgRiskReward

    // Clamp to [0, 0.25] and apply fraction for safety
    const clampedKelly = Math.max(0, Math.min(kellyPct, 0.25))
    const finalPct = clampedKelly * this.fraction

    const allocatedEquity = balance.total * finalPct
    const quantity = request.price > 0 ? allocatedEquity / request.price : 0
    const notionalValue = quantity * request.price

    const riskAmount = request.stopLoss
      ? quantity * Math.abs(request.price - request.stopLoss)
      : 0

    return {
      quantity,
      notionalValue,
      riskAmount,
      riskPct: finalPct,
      pctOfEquity: finalPct,
      method: 'kelly',
    }
  }
}
