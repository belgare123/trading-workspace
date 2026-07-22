// __tests__/ReplayValidator.test.ts
// Phase 5.5 — ReplayValidator unit tests

import { describe, it, expect } from 'vitest'
import { ReplayValidator } from '../ReplayValidator'
import { replayOk, type ReplayReport } from '../ReplayReport'

describe('ReplayValidator', () => {
  it('returns valid for empty report', () => {
    const v = new ReplayValidator()
    const report = replayOk({ eventsProcessed: 0, fromSequence: 0, toSequence: 0 })
    const result = v.validate(report, () => ({ hash: '', eventsApplied: 0 }))
    expect(result.valid).toBe(true)
  })

  it('detects apply errors', () => {
    const v = new ReplayValidator()
    const report = replayOk({
      eventsProcessed: 5,
      fromSequence: 0,
      toSequence: 5,
      aggregateResults: [
        {
          aggregateId: 'trade-1',
          eventsApplied: 0,
          sequenceFrom: 0,
          sequenceTo: 0,
          durationMs: 10,
          stateHash: 'abc',
          error: 'Apply failed for events',
        },
      ],
    })
    const result = v.validate(report, () => ({ hash: '', eventsApplied: 0 }))
    expect(result.valid).toBe(false)
    expect(result.checksFailed).toBeGreaterThan(0)
  })

  it('detects sequence regression', () => {
    const v = new ReplayValidator()
    const report = replayOk({
      eventsProcessed: 1,
      fromSequence: 0,
      toSequence: 1,
      aggregateResults: [
        {
          aggregateId: 'trade-1',
          eventsApplied: 1,
          sequenceFrom: 10,
          sequenceTo: 5, // regression!
          durationMs: 10,
          stateHash: 'abc',
        },
      ],
    })
    const result = v.validate(report, () => ({ hash: 'abc', eventsApplied: 1 }))
    expect(result.valid).toBe(false)
    expect(result.aggregates['trade-1'].sequencesValid).toBe(false)
  })

  it('checks expected state hashes', () => {
    const expected = new Map<string, string>([['trade-1', 'abc123']])
    const v = new ReplayValidator({ expectedStateHashes: expected })

    const report = replayOk({
      eventsProcessed: 1,
      fromSequence: 0,
      toSequence: 1,
      aggregateResults: [
        {
          aggregateId: 'trade-1',
          eventsApplied: 1,
          sequenceFrom: 0,
          sequenceTo: 1,
          durationMs: 5,
          stateHash: 'abc123',
        },
      ],
    })
    const result = v.validate(report, () => ({ hash: 'abc123', eventsApplied: 1 }))
    expect(result.aggregates['trade-1'].hashMatchesExpected).toBe(true)
  })

  it('warns on low events count', () => {
    const v = new ReplayValidator({ minEventsApplied: 10 })
    const report = replayOk({
      eventsProcessed: 3,
      fromSequence: 0,
      toSequence: 3,
      aggregateResults: [
        {
          aggregateId: 'trade-1',
          eventsApplied: 3,
          sequenceFrom: 0,
          sequenceTo: 3,
          durationMs: 5,
          stateHash: 'abc',
        },
      ],
    })
    const result = v.validate(report, () => ({ hash: 'abc', eventsApplied: 3 }))
    const w = result.aggregates['trade-1']?.warnings ?? []
    expect(w.some(w => w.includes('Only 3'))).toBe(true)
  })

  it('detects large sequence gap between aggregates', () => {
    const v = new ReplayValidator({ maxSequenceGap: 10 })
    const report = replayOk({
      eventsProcessed: 5,
      fromSequence: 0,
      toSequence: 5,
      aggregateResults: [
        {
          aggregateId: 'trade-1',
          eventsApplied: 1,
          sequenceFrom: 0,
          sequenceTo: 1,
          durationMs: 5,
          stateHash: 'a',
        },
        {
          aggregateId: 'wallet-1',
          eventsApplied: 1,
          sequenceFrom: 100,
          sequenceTo: 101,
          durationMs: 5,
          stateHash: 'b',
        },
      ],
    })
    const result = v.validate(report, () => ({ hash: '', eventsApplied: 0 }))
    expect(result.valid).toBe(false)
  })
})
