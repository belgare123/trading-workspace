// ── CommissionModel — Interface + built-in implementations ──
//
// @since 3.5.1

import type { CommissionModel, OrderSide, OrderType } from '../types'

/** No commission */
export class ZeroCommission implements CommissionModel {
  calculate(): number {
    return 0
  }
}

/** Flat fee per trade */
export class FlatCommission implements CommissionModel {
  fee: number

  constructor(fee: number) {
    this.fee = fee
  }

  calculate(): number {
    return this.fee
  }
}

/** Percentage-based commission */
export class PercentageCommission implements CommissionModel {
  makerPct: number
  takerPct: number
  isMaker: (type: OrderType) => boolean

  constructor(
    makerPct: number,
    takerPct: number,
    isMaker: (type: OrderType) => boolean = t => t === 'limit',
  ) {
    this.makerPct = makerPct
    this.takerPct = takerPct
    this.isMaker = isMaker
  }

  calculate({ quantity, price, orderType }: {
    symbol: string
    side: OrderSide
    quantity: number
    price: number
    orderType: OrderType
  }): number {
    const pct = this.isMaker(orderType) ? this.makerPct : this.takerPct
    return quantity * price * pct
  }
}

/** Binance-style tiered commission */
export class BinanceCommission implements CommissionModel {
  tier: number
  private readonly rates = [
    { maker: 0.001, taker: 0.001 },  // Tier 0
    { maker: 0.0008, taker: 0.001 },  // VIP 1
    { maker: 0.0006, taker: 0.0008 }, // VIP 2
  ]

  constructor(tier: number = 0) {
    this.tier = tier
  }

  calculate({ quantity, price, orderType }: {
    symbol: string
    side: OrderSide
    quantity: number
    price: number
    orderType: OrderType
  }): number {
    const rate = this.rates[Math.min(this.tier, this.rates.length - 1)]
    const pct = orderType === 'limit' ? rate.maker : rate.taker
    return quantity * price * pct
  }
}

export const commissionModels = {
  zero: () => new ZeroCommission(),
  flat: (fee: number) => new FlatCommission(fee),
  percentage: (maker: number, taker: number) => new PercentageCommission(maker, taker),
  binance: (tier?: number) => new BinanceCommission(tier),
} as const
