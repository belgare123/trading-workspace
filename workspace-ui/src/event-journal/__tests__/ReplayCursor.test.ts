// __tests__/ReplayCursor.test.ts
// Phase 5.3 — ReplayCursor unit tests

import { describe, it, expect } from 'vitest'
import { ReplayCursor } from '../ReplayCursor'

describe('ReplayCursor', () => {
  it('starts at given sequence', () => {
    const c = new ReplayCursor(10)
    expect(c.current).toBe(10)
  })

  it('starts at 0 by default', () => {
    const c = new ReplayCursor()
    expect(c.current).toBe(0)
  })

  it('advances by one', () => {
    const c = new ReplayCursor(5)
    c.advance()
    expect(c.current).toBe(6)
  })

  it('jumps to a sequence', () => {
    const c = new ReplayCursor(5)
    c.jumpTo(10)
    expect(c.current).toBe(10)
  })

  it('throws when jumping backwards', () => {
    const c = new ReplayCursor(10)
    expect(() => c.jumpTo(5)).toThrow('Cannot jump back')
  })

  it('save and restore work correctly', () => {
    const c = new ReplayCursor(5)
    c.jumpTo(10)
    c.save()
    c.jumpTo(20)
    c.restore()
    expect(c.current).toBe(10)
  })

  it('snapshot and reset work correctly', () => {
    const c = new ReplayCursor(5)
    c.snapshot()
    c.jumpTo(15)
    c.reset()
    expect(c.current).toBe(5)
  })

  it('reports progress since snapshot', () => {
    const c = new ReplayCursor(10)
    c.snapshot()
    c.jumpTo(25)
    expect(c.progress).toBe(15)
  })

  it('reports sinceCheckpoint', () => {
    const c = new ReplayCursor(10)
    c.jumpTo(15)
    expect(c.sinceCheckpoint).toBe(5)

    c.save()
    expect(c.sinceCheckpoint).toBe(0)
  })
})
