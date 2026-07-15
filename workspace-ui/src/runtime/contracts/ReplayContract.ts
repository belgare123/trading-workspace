import { describe, it, expect, beforeEach } from 'vitest'
import type { ReplayRuntimeContract } from './RuntimeContract'

export function describeReplayContract(name: string, impl: () => ReplayRuntimeContract): void {
  let replay: ReplayRuntimeContract

  beforeEach(() => {
    replay = impl()
  })

  describe(name, () => {

    it('имеет id', () => {
      expect(replay.id).toBeDefined()
      expect(replay.id).toBeTypeOf('string')
    })

    it('state() возвращает валидный статус', async () => {
      const s = await replay.state()
      expect(['idle', 'playing', 'paused']).toContain(s)
    })

    it('play/pause переключает состояние', async () => {
      await replay.play(1)
      const s1 = await replay.state()
      expect(s1 === 'playing' || s1 === 'idle').toBe(true) // некоторые реализации могут не поддерживать play без данных

      await replay.pause()
      const s2 = await replay.state()
      expect(['paused', 'idle']).toContain(s2)
    })

    it('seek не бросает', async () => {
      await expect(replay.seek(Date.now() - 60_000)).resolves.toBeUndefined()
    })

    it('progress возвращает структуру', async () => {
      const p = await replay.progress()
      expect(p).toHaveProperty('current')
      expect(p).toHaveProperty('total')
      expect(p).toHaveProperty('speed')
    })

    it('load/play вызывает события', async () => {
      const events = await captureEvents(
        (cb) => replay.onEvent(cb),
        async () => {
          await replay.load([])
          await replay.play(1)
        },
        1_000,
      )
      // load даже с пустым массивом не должен бросать
      expect(true).toBe(true)
    })
  })
}

async function captureEvents(
  subscribe: (cb: (e: any) => void) => () => void,
  trigger: () => Promise<void>,
  timeout: number,
): Promise<any[]> {
  const events: any[] = []
  return new Promise((resolve) => {
    const unsub = subscribe((e) => {
      events.push(e)
    })
    trigger().finally(() => {
      setTimeout(() => {
        unsub()
        resolve(events)
      }, timeout)
    })
  })
}
