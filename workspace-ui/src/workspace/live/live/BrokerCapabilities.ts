/**
 * BrokerCapabilities.ts — Feature capability query layer
 *
 * Allows strategy code to query what operations the broker supports
 * without ever asking "which exchange is this?".
 *
 * @since 4.5
 */

export interface BrokerCapabilities {
  // ── Order Types ──
  supportsMarket: boolean
  supportsLimit: boolean
  supportsStop: boolean
  supportsStopLimit: boolean
  supportsOCO: boolean                // One-Cancels-Other
  supportsTrailingStop: boolean

  // ── Position Management ──
  supportsReduceOnly: boolean
  supportsHedgeMode: boolean         // Simultaneous long + short
  supportsPositionTrading: boolean   // Inverse futures, etc.

  // ── Account Types ──
  supportsMargin: boolean
  supportsFutures: boolean
  supportsSpot: boolean

  // ── Order Features ──
  supportsPostOnly: boolean
  supportsIceberg: boolean
  supportsSelfTradePrevention: boolean
  supportsTimeInForce: boolean        // GTC / IOC / FOK
  supportsMinNotional: boolean

  // ── Connectivity ──
  supportsWebSocket: boolean
  supportsPolling: boolean

  // ── Market Data ──
  providesTicker: boolean
  providesOrderBook: boolean
  providesTrades: boolean
  providesKlines: boolean
}

/** Default: all disabled */
export const NO_CAPABILITIES: BrokerCapabilities = {
  supportsMarket: false,
  supportsLimit: false,
  supportsStop: false,
  supportsStopLimit: false,
  supportsOCO: false,
  supportsTrailingStop: false,
  supportsReduceOnly: false,
  supportsHedgeMode: false,
  supportsPositionTrading: false,
  supportsMargin: false,
  supportsFutures: false,
  supportsSpot: false,
  supportsPostOnly: false,
  supportsIceberg: false,
  supportsSelfTradePrevention: false,
  supportsTimeInForce: false,
  supportsMinNotional: false,
  supportsWebSocket: false,
  supportsPolling: true,
  providesTicker: false,
  providesOrderBook: false,
  providesTrades: false,
  providesKlines: false,
}

/** Binance Spot capabilities */
export const BINANCE_SPOT_CAPABILITIES: BrokerCapabilities = {
  ...NO_CAPABILITIES,
  supportsMarket: true,
  supportsLimit: true,
  supportsStop: true,
  supportsStopLimit: true,
  supportsOCO: true,
  supportsTrailingStop: false,
  supportsReduceOnly: false,
  supportsHedgeMode: false,
  supportsPositionTrading: false,
  supportsMargin: false,
  supportsFutures: false,
  supportsSpot: true,
  supportsPostOnly: true,
  supportsIceberg: true,
  supportsSelfTradePrevention: true,
  supportsTimeInForce: true,
  supportsMinNotional: true,
  supportsWebSocket: true,
  providesTicker: true,
  providesOrderBook: true,
  providesTrades: true,
  providesKlines: true,
}

/** Binance Futures capabilities */
export const BINANCE_FUTURES_CAPABILITIES: BrokerCapabilities = {
  ...NO_CAPABILITIES,
  supportsMarket: true,
  supportsLimit: true,
  supportsStop: true,
  supportsStopLimit: true,
  supportsOCO: false,
  supportsTrailingStop: true,
  supportsReduceOnly: true,
  supportsHedgeMode: true,
  supportsPositionTrading: true,
  supportsMargin: true,
  supportsFutures: true,
  supportsSpot: false,
  supportsPostOnly: true,
  supportsIceberg: false,
  supportsSelfTradePrevention: false,
  supportsTimeInForce: true,
  supportsMinNotional: true,
  supportsWebSocket: true,
  providesTicker: true,
  providesOrderBook: true,
  providesTrades: true,
  providesKlines: true,
}

/** Bybit capabilities */
export const BYBIT_CAPABILITIES: BrokerCapabilities = {
  ...NO_CAPABILITIES,
  supportsMarket: true,
  supportsLimit: true,
  supportsStop: true,
  supportsStopLimit: true,
  supportsOCO: false,
  supportsTrailingStop: true,
  supportsReduceOnly: true,
  supportsHedgeMode: true,
  supportsPositionTrading: true,
  supportsMargin: true,
  supportsFutures: true,
  supportsSpot: true,
  supportsPostOnly: true,
  supportsIceberg: false,
  supportsSelfTradePrevention: false,
  supportsTimeInForce: true,
  supportsMinNotional: true,
  supportsWebSocket: true,
  providesTicker: true,
  providesOrderBook: true,
  providesTrades: true,
  providesKlines: true,
}
