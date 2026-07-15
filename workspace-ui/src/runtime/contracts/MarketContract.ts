/**
 * MarketRuntime Contract Tests
 *
 * Любая реализация MarketRuntime (REST, WS, Simulation, Mock, Cloud)
 * должна проходить этот набор тестов.
 *
 * Usage:
 *   import { describeMarketContract } from '../contracts/MarketContract'
 *   describeMarketContract('Mock MarketRuntime', mockMarket)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { MarketRuntimeContract, RuntimeEvent } from './RuntimeContract'
import { waitForEvent } from './RuntimeContract'

export function describeMarketContract(name: string, impl: () => MarketRuntimeContract): void {
  let market: MarketRuntimeContract

  beforeEach(() => {
    market = impl()
  })

  describe(name, () => {

    // ── Metadata ──

    it('имеет id', () => {
      expect(market.id).toBeDefined()
      expect(market.id).toBeTypeOf('string')
      expect(market.id.length).toBeGreaterThan(0)
    })

    // ── Symbols ──

    it('возвращает список символов', async () => {
      const symbols = await market.symbols()
      expect(Array.isArray(symbols)).toBe(true)
      expect(symbols.length).toBeGreaterThan(0)
      // Каждый символ — непустая строка
      for (const s of symbols) {
        expect(s).toBeTypeOf('string')
        expect(s.length).toBeGreaterThan(0)
      }
    })

    // ── Subscribe / Unsubscribe ──

    it('подписывается на символы', async () => {
      const symbols = await market.symbols()
      const target = symbols.slice(0, Math.min(2, symbols.length))

      await expect(market.subscribe(target)).resolves.toBeUndefined()
    })

    it('отписывается от символов', async () => {
      const symbols = await market.symbols()
      const target = symbols.slice(0, Math.min(2, symbols.length))

      await market.subscribe(target)
      await expect(market.unsubscribe(target)).resolves.toBeUndefined()
    })

    it('подписка на пустой список не вызывает ошибку', async () => {
      await expect(market.subscribe([])).resolves.toBeUndefined()
    })

    it('отписка от пустого списка не вызывает ошибку', async () => {
      await expect(market.unsubscribe([])).resolves.toBeUndefined()
    })

    // ── Health ──

    it('health() возвращает ok и latency', async () => {
      const h = await market.health()
      expect(h).toHaveProperty('ok')
      expect(h.ok).toBeTypeOf('boolean')
      expect(h).toHaveProperty('latency')
      expect(h.latency).toBeTypeOf('number')
      expect(h.latency).toBeGreaterThanOrEqual(0)
    })

    // ── Events ──

    it('onEvent возвращает функцию отписки', () => {
      const unsub = market.onEvent(() => {})
      expect(unsub).toBeTypeOf('function')
      // Отписка не должна бросать
      expect(() => unsub()).not.toThrow()
    })

    it('onEvent может получить событие', async () => {
      const symbols = await market.symbols()
      const target = symbols.slice(0, Math.min(1, symbols.length))

      const eventPromise = waitForEvent(
        (cb) => market.onEvent(cb),
        (e) => e.topic.startsWith('market.'),
      )

      await market.subscribe(target)
      await expect(eventPromise).resolves.toBeDefined()
    }, 10_000)

    // ── OrderBook (optional) ──

    it('orderBook возвращает структуру (если реализован)', async () => {
      if (!market.orderBook) return

      const symbols = await market.symbols()
      if (symbols.length === 0) return

      const ob = await market.orderBook(symbols[0])
      expect(ob).toHaveProperty('bids')
      expect(ob).toHaveProperty('asks')
      expect(Array.isArray(ob.bids)).toBe(true)
      expect(Array.isArray(ob.asks)).toBe(true)
    })

    // ── Candles (optional) ──

    it('candles возвращает массив свечей (если реализован)', async () => {
      if (!market.candles) return

      const symbols = await market.symbols()
      if (symbols.length === 0) return

      const candles = await market.candles(symbols[0])
      expect(Array.isArray(candles)).toBe(true)
      if (candles.length > 0) {
        const c = candles[0]
        expect(c).toHaveProperty('time')
        expect(c).toHaveProperty('open')
        expect(c).toHaveProperty('high')
        expect(c).toHaveProperty('low')
        expect(c).toHaveProperty('close')
        expect(c).toHaveProperty('volume')
      }
    })
  })
}
