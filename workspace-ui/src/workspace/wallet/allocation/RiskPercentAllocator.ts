// ── RiskPercentAllocator — risk-based position sizing ──
// Sprint 5.6 — WalletManager

import type { AllocationPolicy, AllocationRequest, AllocationResult, Balance } from '../types'

/**
 * RiskPercentAllocator calculates position size based on risk:
 *   quantity = (equity × riskPercent) / |entryPrice − stopLoss|
 *
 * This ensures that if stop-loss hits, the loss is exactly riskPercent of equity.
 */
export class RiskPercentAllocator implements AllocationPolicy {
  readonly id = 'risk-percent'
  private readonly riskPercent: number
  private readonly maxLeverage: number

  constructor(config: { riskPercent: number; maxLeverage?: number }) {
    if (config.riskPercent <= 0 || config.riskPercent > 1) {
      throw new Error('RiskPercentAllocator: riskPercent must be in (0, 1]')
    }
    this.riskPercent = config.riskPercent
    this.maxLeverage = config.maxLeverage ?? 1
  }

  allocate(request: AllocationRequest, balance: Balance): AllocationResult {
    const riskCapital = balance.total * this.riskPercent * this.maxLeverage

    if (!request.stopLoss || request.stopLoss <= 0) {
      // No stop-loss defined — fall back to fixed percent of equity
      const quantity = riskCapital / request.price
      return {
        quantity,
        notionalValue: quantity * request.price,
        riskAmount: riskCapital,
        riskPct: this.riskPercent,
        pctOfEquity: this.riskPercent * this.maxLeverage,
        method: 'risk-percent-fallback',
      }
    }

    const priceRisk = Math.abs(request.price - request.stopLoss)
    if (priceRisk <= 0) {
      throw new Error('RiskPercentAllocator: stopLoss equals entry price, cannot compute risk')
    }

    const quantity = riskCapital / priceRisk
    const notionalValue = quantity * request.price

    return {
      quantity,
      notionalValue,
      riskAmount: riskCapital,
      riskPct: this.riskPercent,
      pctOfEquity: (notionalValue / balance.total) * (1 / this.maxLeverage),
      method: 'risk-percent',
    }
  }
}
