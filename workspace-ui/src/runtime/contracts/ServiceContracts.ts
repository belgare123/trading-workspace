import { describe, it, expect, beforeEach } from 'vitest'
import type { PortfolioRuntimeContract, StrategyRuntimeContract, MLRuntimeContract, SearchRuntimeContract, EventStoreRuntimeContract, NotificationRuntimeContract } from './RuntimeContract'

// ── Portfolio ──

export function describePortfolioContract(name: string, impl: () => PortfolioRuntimeContract): void {
  let svc: PortfolioRuntimeContract

  beforeEach(() => { svc = impl() })

  describe(name, () => {
    it('balance() возвращает массив балансов', async () => {
      const b = await svc.balance()
      expect(Array.isArray(b)).toBe(true)
      if (b.length > 0) {
        expect(b[0]).toHaveProperty('asset')
        expect(b[0]).toHaveProperty('free')
        expect(b[0]).toHaveProperty('total')
      }
    })

    it('balance(asset) возвращает баланс по активу', async () => {
      const b = await svc.balance('BTC')
      expect(Array.isArray(b)).toBe(true)
    })

    it('positions() возвращает массив позиций', async () => {
      const p = await svc.positions()
      expect(Array.isArray(p)).toBe(true)
      if (p.length > 0) {
        expect(p[0]).toHaveProperty('symbol')
        expect(p[0]).toHaveProperty('side')
        expect(p[0]).toHaveProperty('pnl')
        expect(['long', 'short']).toContain(p[0].side)
      }
    })
  })
}

// ── Strategy ──

export function describeStrategyContract(name: string, impl: () => StrategyRuntimeContract): void {
  let svc: StrategyRuntimeContract

  beforeEach(() => { svc = impl() })

  describe(name, () => {
    it('list() возвращает массив стратегий', async () => {
      const list = await svc.list()
      expect(Array.isArray(list)).toBe(true)
      if (list.length > 0) {
        expect(list[0]).toHaveProperty('id')
        expect(list[0]).toHaveProperty('name')
        expect(list[0]).toHaveProperty('status')
      }
    })

    it('metrics() возвращает Record<string, number>', async () => {
      const list = await svc.list()
      if (list.length > 0) {
        const m = await svc.metrics(list[0].id)
        expect(m).toBeTypeOf('object')
      }
    })

    it('start() / stop() не бросают', async () => {
      const list = await svc.list()
      if (list.length > 0) {
        await expect(svc.start(list[0].id)).resolves.toBeUndefined()
        await expect(svc.stop(list[0].id)).resolves.toBeUndefined()
      }
    })
  })
}

// ── ML ──

export function describeMLContract(name: string, impl: () => MLRuntimeContract): void {
  let svc: MLRuntimeContract

  beforeEach(() => { svc = impl() })

  describe(name, () => {
    it('list() возвращает массив моделей', async () => {
      const list = await svc.list()
      expect(Array.isArray(list)).toBe(true)
      if (list.length > 0) {
        expect(list[0]).toHaveProperty('id')
        expect(list[0]).toHaveProperty('name')
        expect(list[0]).toHaveProperty('status')
      }
    })

    it('predict() возвращает prediction + confidence', async () => {
      const list = await svc.list()
      if (list.length > 0) {
        const r = await svc.predict(list[0].id, [1, 2, 3])
        expect(r).toHaveProperty('prediction')
        expect(r).toHaveProperty('confidence')
      }
    })
  })
}

// ── Search ──

export function describeSearchContract(name: string, impl: () => SearchRuntimeContract): void {
  let svc: SearchRuntimeContract

  beforeEach(() => { svc = impl() })

  describe(name, () => {
    it('search() возвращает результаты', async () => {
      const r = await svc.search('test')
      expect(r).toHaveProperty('results')
      expect(r).toHaveProperty('total')
      expect(Array.isArray(r.results)).toBe(true)
    })
  })
}

// ── EventStore ──

export function describeEventStoreContract(name: string, impl: () => EventStoreRuntimeContract): void {
  let svc: EventStoreRuntimeContract

  beforeEach(() => { svc = impl() })

  describe(name, () => {
    it('store() сохраняет событие', async () => {
      const event = { id: 'test', timestamp: Date.now(), topic: 'test.event', source: 'test', severity: 'info' as const, version: 1, payload: {} }
      await expect(svc.store(event)).resolves.toBeUndefined()
    })

    it('query() возвращает массив событий', async () => {
      const r = await svc.query({ limit: 10 })
      expect(Array.isArray(r)).toBe(true)
    })
  })
}

// ── Notification ──

export function describeNotificationContract(name: string, impl: () => NotificationRuntimeContract): void {
  let svc: NotificationRuntimeContract

  beforeEach(() => { svc = impl() })

  describe(name, () => {
    it('send() возвращает id', async () => {
      const r = await svc.send({ title: 'Test', message: 'Hello', level: 'info' })
      expect(r).toHaveProperty('id')
      expect(r.id).toBeTypeOf('string')
    })

    it('history() возвращает массив', async () => {
      const h = await svc.history()
      expect(Array.isArray(h)).toBe(true)
    })
  })
}
