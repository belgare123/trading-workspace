import { describe, it, expect, beforeEach } from 'vitest'
import type { PluginRuntimeContract } from './RuntimeContract'

export function describePluginContract(name: string, impl: () => PluginRuntimeContract): void {
  let plugin: PluginRuntimeContract

  beforeEach(() => {
    plugin = impl()
  })

  describe(name, () => {
    it('имеет id', () => {
      expect(plugin.id).toBeTypeOf('string')
      expect(plugin.id.length).toBeGreaterThan(0)
    })

    it('list() возвращает массив плагинов', async () => {
      const list = await plugin.list()
      expect(Array.isArray(list)).toBe(true)
    })

    it('info() возвращает manifest и state для существующего плагина', async () => {
      const list = await plugin.list()
      if (list.length > 0) {
        const info = await plugin.info(list[0].id)
        expect(info).toHaveProperty('manifest')
        expect(info).toHaveProperty('state')
      }
    })

    it('info() для несуществующего плагина бросает ошибку', async () => {
      await expect(plugin.info('non-existent-plugin')).rejects.toThrow()
    })
  })
}
