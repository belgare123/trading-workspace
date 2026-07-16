// ── SlippageModel — Interface + built-in implementations ──
//
// @since 3.5.1

import type { SlippageModel } from '../types'

/** No slippage — fill at exact price */
export class NoSlippage implements SlippageModel {
  calculate(): number {
    return 0
  }
}

/** Fixed slippage in price units */
export class FixedSlippage implements SlippageModel {
  amount: number

  constructor(amount: number) {
    this.amount = amount
  }

  calculate(): number {
    return this.amount
  }
}

/** Percentage-based slippage */
export class PercentageSlippage implements SlippageModel {
  pct: number

  constructor(pct: number) {
    this.pct = pct
  }

  calculate({ price }: { side: string; quantity: number; price: number; market: any }): number {
    return price * this.pct
  }
}

/** Volume-aware slippage (wider spread for larger orders) */
export class VolumeBasedSlippage implements SlippageModel {
  basePct: number
  volumeSensitivity: number

  constructor(basePct: number, volumeSensitivity: number = 0.1) {
    this.basePct = basePct
    this.volumeSensitivity = volumeSensitivity
  }

  calculate({ quantity, price }: { side: string; quantity: number; price: number; market: any }): number {
    const sizeRatio = quantity * price / 1_000_000 // per $1M notional
    return price * (this.basePct + sizeRatio * this.volumeSensitivity)
  }
}

export const slippageModels = {
  none: () => new NoSlippage(),
  fixed: (amount: number) => new FixedSlippage(amount),
  percentage: (pct: number) => new PercentageSlippage(pct),
  volumeBased: (basePct: number, volumeSensitivity?: number) =>
    new VolumeBasedSlippage(basePct, volumeSensitivity),
} as const
