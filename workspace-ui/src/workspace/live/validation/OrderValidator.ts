/**
 * OrderValidator.ts — Validates order requests before execution
 *
 * Provides comprehensive pre-trade validation:
 * - Symbol existence (must be registered in SymbolRegistry)
 * - Order structure (missing required fields)
 * - Quantity limits (minQty, maxQty, stepSize)
 * - Price limits (tickSize)
 * - Notional limits (minNotional)
 *
 * Integrated into PaperBrokerAdapter to reject invalid orders
 * before they reach PaperProvider.
 *
 * @since 4.9D
 */

import type { OrderRequest } from '../../execution/types'
import { SymbolRegistry, type SymbolInfo } from '../feed/SymbolRegistry'

// ── Custom Error ──

export class ValidationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ValidationError'
    this.code = code
  }
}

// ── Constants for common Bybit symbols ──
// These provide sensible defaults when SymbolRegistry is not available.
// In production, SymbolRegistry should be populated from exchange info.

const DEFAULT_SYMBOL_RULES: Record<string, Partial<SymbolInfo>> = {
  // Verified against Bybit linear API (2026-07-20)
  // ── priceScale=2 ──
  BTCUSDT: { minQuantity: 0.001, quantityDecimals: 3, priceDecimals: 2, minNotional: 5, stepSize: 0.001, tickSize: 0.1 },
  ETHUSDT: { minQuantity: 0.01, quantityDecimals: 3, priceDecimals: 2, minNotional: 5, stepSize: 0.01, tickSize: 0.01 },
  // ── priceScale=3 ──
  SOLUSDT: { minQuantity: 0.1, quantityDecimals: 1, priceDecimals: 3, minNotional: 5, stepSize: 0.1, tickSize: 0.01 }, // tick=0.010 → 0.01
  AVAXUSDT: { minQuantity: 0.1, quantityDecimals: 1, priceDecimals: 3, minNotional: 5, stepSize: 0.1, tickSize: 0.001 },
  LINKUSDT: { minQuantity: 0.1, quantityDecimals: 1, priceDecimals: 3, minNotional: 5, stepSize: 0.1, tickSize: 0.001 },
  // ── priceScale=4 ──
  XRPUSDT: { minQuantity: 0.1, quantityDecimals: 1, priceDecimals: 4, minNotional: 5, stepSize: 0.1, tickSize: 0.0001 },
  ADAUSDT: { minQuantity: 1, quantityDecimals: 0, priceDecimals: 4, minNotional: 5, stepSize: 1, tickSize: 0.0001 },
  DOTUSDT: { minQuantity: 0.1, quantityDecimals: 1, priceDecimals: 4, minNotional: 5, stepSize: 0.1, tickSize: 0.0001 },
  // ── priceScale=5 ──
  DOGEUSDT: { minQuantity: 1, quantityDecimals: 0, priceDecimals: 5, minNotional: 5, stepSize: 1, tickSize: 0.00001 },
  // ── Legacy/other ──
  MATICUSDT: { minQuantity: 1, quantityDecimals: 0, priceDecimals: 4, minNotional: 5, stepSize: 1, tickSize: 0.0001 },
}

export class OrderValidator {
  private symbolRegistry?: SymbolRegistry
  private customRules: Map<string, Partial<SymbolInfo>>

  constructor(symbolRegistry?: SymbolRegistry) {
    this.symbolRegistry = symbolRegistry
    this.customRules = new Map()

    // Load defaults
    for (const [symbol, rules] of Object.entries(DEFAULT_SYMBOL_RULES)) {
      this.customRules.set(symbol, rules)
    }
  }

  /**
   * Register or override symbol trading rules.
   */
  setSymbolRules(symbol: string, rules: Partial<SymbolInfo>): void {
    this.customRules.set(symbol.toUpperCase(), rules)
  }

  /**
   * Get effective symbol info (registry first, then defaults).
   */
  private getSymbolInfo(symbol: string): SymbolInfo | undefined {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Try registry first
    if (this.symbolRegistry) {
      const info = this.symbolRegistry.get(normalized)
      if (info) return info
    }

    // Fall back to defaults
    const defaults = this.customRules.get(normalized)
    if (defaults) {
      return {
        symbol: normalized,
        baseAsset: normalized.replace('USDT', ''),
        quoteAsset: 'USDT',
        priceDecimals: defaults.priceDecimals ?? 2,
        quantityDecimals: defaults.quantityDecimals ?? 4,
        minNotional: defaults.minNotional ?? 10,
        minQuantity: defaults.minQuantity ?? 0.001,
        maxQuantity: defaults.maxQuantity,
        stepSize: defaults.stepSize,
        tickSize: defaults.tickSize,
        status: 'active',
      }
    }

    // Unknown symbol — return generic info but flag as inactive
    return {
      symbol: normalized,
      baseAsset: normalized.replace('USDT', ''),
      quoteAsset: 'USDT',
      priceDecimals: 2,
      quantityDecimals: 4,
      minNotional: 10,
      minQuantity: 0.001,
      status: 'inactive',
    }
  }

  /**
   * Validate an order request. Throws ValidationError on any violation.
   */
  validate(request: OrderRequest): void {
    const { symbol, side, type, quantity, price, stopPrice, reduceOnly } = request
    const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // ── 1. Symbol existence ──
    const info = this.getSymbolInfo(normalizedSymbol)
    if (!info || info.status !== 'active') {
      throw new ValidationError(
        'UNKNOWN_SYMBOL',
        `Unknown or inactive symbol: ${symbol}. Must be registered in SymbolRegistry.`,
      )
    }

    // ── 2. Side validation ──
    if (side !== 'buy' && side !== 'sell') {
      throw new ValidationError(
        'INVALID_SIDE',
        `Invalid side: ${side}. Must be 'buy' or 'sell'.`,
      )
    }

    // ── 3. Quantity validation ──
    if (quantity == null || quantity <= 0) {
      throw new ValidationError(
        'INVALID_QUANTITY',
        `Quantity must be > 0, got ${quantity}`,
      )
    }

    // Check minQty
    if (quantity < info.minQuantity) {
      throw new ValidationError(
        'MIN_QTY',
        `Quantity ${quantity} < min ${info.minQuantity} for ${symbol}`,
      )
    }

    // Check maxQty
    if (info.maxQuantity != null && quantity > info.maxQuantity) {
      throw new ValidationError(
        'MAX_QTY',
        `Quantity ${quantity} > max ${info.maxQuantity} for ${symbol}`,
      )
    }

    // Check stepSize (quantity precision)
    if (info.stepSize != null && info.stepSize > 0) {
      // Use scaled integers to avoid floating-point precision issues
      const scale = Math.max(
        Math.ceil(Math.abs(Math.log10(info.stepSize))),
        Math.ceil(Math.abs(Math.log10(quantity))),
      ) + 2
      const factor = Math.pow(10, scale)
      const qtyScaled = Math.round(quantity * factor)
      const stepScaled = Math.round(info.stepSize * factor)
      if (qtyScaled % stepScaled !== 0) {
        throw new ValidationError(
          'QTY_PRECISION',
          `Quantity ${quantity} does not match stepSize ${info.stepSize} for ${symbol}. ` +
          `Quantity must be a multiple of ${info.stepSize}.`,
        )
      }
    }

    // ── 4. Price validation ──
    if (type === 'LIMIT' || type === 'STOP_LIMIT' || type === 'TAKE_PROFIT_LIMIT') {
      if (price == null || price <= 0) {
        throw new ValidationError(
          'INVALID_PRICE',
          `${type} order requires a valid price > 0, got ${price}`,
        )
      }

      // Check tickSize (price precision)
      if (info.tickSize != null && info.tickSize > 0) {
        const scale = Math.max(
          Math.ceil(Math.abs(Math.log10(info.tickSize))),
          Math.ceil(Math.abs(Math.log10(price))),
        ) + 2
        const factor = Math.pow(10, scale)
        const priceScaled = Math.round(price * factor)
        const tickScaled = Math.round(info.tickSize * factor)
        if (priceScaled % tickScaled !== 0) {
          throw new ValidationError(
            'PRICE_PRECISION',
            `Price ${price} does not match tickSize ${info.tickSize} for ${symbol}. ` +
            `Price must be a multiple of ${info.tickSize}.`,
          )
        }
      }
    }

    // ── 5. Stop price for conditional orders ──
    if (type === 'STOP_MARKET' || type === 'STOP_LIMIT' || type === 'TRAILING_STOP') {
      if (stopPrice == null || stopPrice <= 0) {
        throw new ValidationError(
          'INVALID_STOP_PRICE',
          `${type} order requires a valid stopPrice > 0, got ${stopPrice}`,
        )
      }
    }

    // ── 6. Take profit / Stop loss structure ──
    if (type === 'TAKE_PROFIT' || type === 'TAKE_PROFIT_LIMIT' || type === 'STOP_LOSS' || type === 'STOP_LOSS_LIMIT') {
      if (!reduceOnly) {
        throw new ValidationError(
          'REDUCE_ONLY_REQUIRED',
          `${type} order must have reduceOnly=true (TP/SL orders are reduce-only)`,
        )
      }
    }

    // ── 7. Notional check (price * qty >= minNotional) ──
    // For MARKET buy, use estimated price
    // For other orders, use actual price if available
    if (type === 'MARKET' || type === 'LIMIT') {
      const effectivePrice = type === 'LIMIT' && price ? price : 0
      if (effectivePrice > 0) {
        const notional = effectivePrice * quantity
        if (notional < info.minNotional) {
          throw new ValidationError(
            'MIN_NOTIONAL',
            `Order notional ${notional.toFixed(2)} < min notional ${info.minNotional} for ${symbol}. ` +
            `Increase quantity or price.`,
          )
        }
      }
    }

    // ── 8. Negative/bad quantities ──
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError(
        'BAD_QUANTITY',
        `Invalid quantity: ${quantity}. Must be a positive finite number.`,
      )
    }
  }

  /**
   * Check if a symbol is known and active.
   */
  isSymbolValid(symbol: string): boolean {
    const info = this.getSymbolInfo(symbol)
    return info !== undefined && info.status === 'active'
  }
}
