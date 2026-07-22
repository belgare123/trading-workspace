/**
 * OrderValidator.test.ts — Verifies exchange rules match Bybit API
 *
 * These tests validate that hardcoded DEFAULT_SYMBOL_RULES match
 * the actual Bybit linear perpetual API values for all supported symbols.
 *
 * @since Sprint 5.8 Production Launch Gate
 */

import { describe, it, expect } from 'vitest'
import { OrderValidator, ValidationError } from './OrderValidator'

describe('OrderValidator — Exchange Rules Compliance', () => {
  const validator = new OrderValidator()

  // ── Valid orders ──

  it('BTCUSDT market buy with valid quantity', () => {
    expect(() => validator.validate({
      symbol: 'BTCUSDT', side: 'buy', type: 'MARKET', quantity: 0.01,
    })).not.toThrow()
  })

  it('ETHUSDT limit order with valid price and quantity', () => {
    expect(() => validator.validate({
      symbol: 'ETHUSDT', side: 'sell', type: 'LIMIT', quantity: 0.1, price: 2500.00,
    })).not.toThrow()
  })

  it('XRPUSDT limit order at valid price (tickSize=0.0001)', () => {
    // Bybit XRPUSDT has tickSize=0.0001, priceScale=4
    expect(() => validator.validate({
      symbol: 'XRPUSDT', side: 'buy', type: 'LIMIT', quantity: 10, price: 0.6111,
    })).not.toThrow()
  })

  it('XRPUSDT market buy with valid quantity (stepSize=0.1)', () => {
    expect(() => validator.validate({
      symbol: 'XRPUSDT', side: 'buy', type: 'MARKET', quantity: 10.5,
    })).not.toThrow()
  })

  // ── Rejected: invalid quantity ──

  it('rejects zero quantity', () => {
    expect(() => validator.validate({
      symbol: 'BTCUSDT', side: 'buy', type: 'MARKET', quantity: 0,
    })).toThrow(ValidationError)
  })

  it('rejects below minQty for XRPUSDT (min=0.1)', () => {
    expect(() => validator.validate({
      symbol: 'XRPUSDT', side: 'buy', type: 'MARKET', quantity: 0.01,
    })).toThrow(ValidationError)
  })

  it('rejects XRPUSDT price not matching tickSize=0.0001', () => {
    // 0.61115 is not a multiple of 0.0001 (5 decimal places)
    expect(() => validator.validate({
      symbol: 'XRPUSDT', side: 'buy', type: 'LIMIT', quantity: 10, price: 0.61115,
    })).toThrow(ValidationError)
  })

  it('rejects XRPUSDT quantity not matching stepSize=0.1', () => {
    // 10.55 is not a multiple of 0.1
    expect(() => validator.validate({
      symbol: 'XRPUSDT', side: 'buy', type: 'MARKET', quantity: 10.55,
    })).toThrow(ValidationError)
  })

  // ── Reduce-only validation ──

  it('rejects TP/SL orders without reduceOnly', () => {
    expect(() => validator.validate({
      symbol: 'BTCUSDT', side: 'sell', type: 'TAKE_PROFIT', quantity: 0.01, price: 30000,
    })).toThrow(ValidationError)
  })

  it('accepts TP orders with reduceOnly=true', () => {
    expect(() => validator.validate({
      symbol: 'BTCUSDT', side: 'sell', type: 'TAKE_PROFIT', quantity: 0.01, price: 30000, reduceOnly: true,
    })).not.toThrow()
  })

  it('accepts SL orders with reduceOnly=true', () => {
    expect(() => validator.validate({
      symbol: 'BTCUSDT', side: 'sell', type: 'STOP_LOSS', quantity: 0.01, stopPrice: 20000, reduceOnly: true,
    })).not.toThrow()
  })

  // ── Price precision (tickSize) ──

  it('BTCUSDT rejects price exceeding tickSize=0.1 precision', () => {
    // BTCUSDT tickSize=0.1, so 30000.15 is not valid
    expect(() => validator.validate({
      symbol: 'BTCUSDT', side: 'buy', type: 'LIMIT', quantity: 0.01, price: 30000.15,
    })).toThrow(ValidationError)
  })

  it('BTCUSDT accepts price at valid tickSize=0.1', () => {
    expect(() => validator.validate({
      symbol: 'BTCUSDT', side: 'buy', type: 'LIMIT', quantity: 0.01, price: 30000.10,
    })).not.toThrow()
  })

  it('SOLUSDT price matching tickSize=0.01', () => {
    // Bybit SOLUSDT tickSize=0.010 → 0.01
    expect(() => validator.validate({
      symbol: 'SOLUSDT', side: 'buy', type: 'LIMIT', quantity: 1, price: 145.23,
    })).not.toThrow()
  })

  it('SOLUSDT price NOT matching tickSize=0.01 (too precise)', () => {
    expect(() => validator.validate({
      symbol: 'SOLUSDT', side: 'buy', type: 'LIMIT', quantity: 1, price: 145.234,
    })).toThrow(ValidationError)
  })

  // ── Quantity precision (stepSize) ──

  it('ETHUSDT quantity matching stepSize=0.01', () => {
    // Bybit ETHUSDT stepSize=0.01
    expect(() => validator.validate({
      symbol: 'ETHUSDT', side: 'buy', type: 'MARKET', quantity: 1.23,
    })).not.toThrow()
  })

  it('ETHUSDT quantity NOT matching stepSize=0.01 (too precise)', () => {
    expect(() => validator.validate({
      symbol: 'ETHUSDT', side: 'buy', type: 'MARKET', quantity: 1.234,
    })).toThrow(ValidationError)
  })

  // ── DOGEUSDT precision (priceScale=5) ──

  it('DOGEUSDT price matching tickSize=0.00001', () => {
    expect(() => validator.validate({
      symbol: 'DOGEUSDT', side: 'buy', type: 'LIMIT', quantity: 100, price: 0.12000,
    })).not.toThrow()
  })

  it('DOGEUSDT price NOT matching tickSize=0.00001', () => {
    expect(() => validator.validate({
      symbol: 'DOGEUSDT', side: 'buy', type: 'LIMIT', quantity: 100, price: 0.123456,
    })).toThrow(ValidationError)
  })

  // ── Symbol active status ──

  it('throws for unknown symbol', () => {
    expect(() => validator.validate({
      symbol: 'NONEXISTENT', side: 'buy', type: 'MARKET', quantity: 1,
    })).toThrow(ValidationError)
  })

  // ── Valid with all symbol types in defaults ──

  it('validates all hardcoded symbols accept valid orders', () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'MATICUSDT']
    for (const sym of symbols) {
      expect(() => validator.validate({
        symbol: sym, side: 'buy', type: 'MARKET', quantity: 10,
      })).not.toThrow()
    }
  })

  // ── Quantity steps edge cases ──

  it('rejects quantity with more decimals than step allows', () => {
    // SOLUSDT stepSize=0.1, so 10.55 is invalid (0.55 not multiple of 0.1)
    expect(() => validator.validate({
      symbol: 'SOLUSDT', side: 'buy', type: 'MARKET', quantity: 10.55,
    })).toThrow(ValidationError)
  })

  it('rejects price with more decimals than tick allows', () => {
    // LINKUSDT tickSize=0.001, so 15.1234 has too many decimals
    expect(() => validator.validate({
      symbol: 'LINKUSDT', side: 'buy', type: 'LIMIT', quantity: 10, price: 15.1234,
    })).toThrow(ValidationError)
  })
})
