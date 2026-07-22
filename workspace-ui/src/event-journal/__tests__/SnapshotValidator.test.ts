// __tests__/SnapshotValidator.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { SnapshotValidator } from '../SnapshotValidator'
import { SnapshotSerializer, SnapshotChecksumError } from '../SnapshotSerializer'
import type { SnapshotRecord } from '../SnapshotValidator'

describe('SnapshotValidator', () => {
  const serializer = new SnapshotSerializer()
  let validator: SnapshotValidator

  beforeEach(() => {
    validator = new SnapshotValidator(serializer, [1, 2])
  })

  function makeRecord(overrides: Partial<SnapshotRecord> = {}): SnapshotRecord {
    return {
      snapshot_id: 'ss-1',
      aggregate_id: 'trade-xrp',
      sequence: 100,
      snapshot_version: 1,
      checksum: null,
      last_applied_sequence: 100,
      created_at: Date.now(),
      payload: JSON.stringify({ balance: 1000 }),
      ...overrides,
    }
  }

  it('validates a healthy record', () => {
    const result = validator.validate(makeRecord())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing snapshot_id', () => {
    const result = validator.validate(makeRecord({ snapshot_id: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing snapshot_id')
  })

  it('rejects missing aggregate_id', () => {
    const result = validator.validate(makeRecord({ aggregate_id: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing aggregate_id')
  })

  it('rejects negative sequence', () => {
    const result = validator.validate(makeRecord({ sequence: -1 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Invalid sequence'))).toBe(true)
  })

  it('rejects unsupported version', () => {
    const result = validator.validate(makeRecord({ snapshot_version: 999 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Unsupported snapshot version'))).toBe(true)
  })

  it('accepts version 2', () => {
    const result = validator.validate(makeRecord({ snapshot_version: 2 }))
    expect(result.valid).toBe(true)
  })

  it('warns when last_applied_sequence < sequence', () => {
    const result = validator.validate(makeRecord({ last_applied_sequence: 50, sequence: 100 }))
    expect(result.valid).toBe(true) // warnings don't invalidate
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('last_applied_sequence')
  })

  it('validates checksum if present', () => {
    const serialized = serializer.serialize({ balance: 1000 })
    const result = validator.validate(makeRecord({
      checksum: serialized.checksum,
      payload: serialized.data,
    }))
    expect(result.valid).toBe(true)
  })

  it('rejects tampered checksum', () => {
    const result = validator.validate(makeRecord({
      checksum: '0000000000000000000000000000000000000000000000000000000000000000',
      payload: JSON.stringify({ balance: 999 }),
    }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Checksum mismatch'))).toBe(true)
  })

  it('quickCheck passes for valid records', () => {
    expect(validator.quickCheck(makeRecord())).toBe(true)
  })

  it('quickCheck fails for invalid records', () => {
    expect(validator.quickCheck(makeRecord({ snapshot_id: '' }))).toBe(false)
    expect(validator.quickCheck(makeRecord({ aggregate_id: '' }))).toBe(false)
    expect(validator.quickCheck(makeRecord({ sequence: -1 }))).toBe(false)
    expect(validator.quickCheck(makeRecord({ snapshot_version: 999 }))).toBe(false)
  })

  it('defaults to supporting both version 1 and 2', () => {
    const v = new SnapshotValidator(serializer)
    // Now defaults to [1, 2] so both versions are valid
    expect(v.validate(makeRecord({ snapshot_version: 1 })).valid).toBe(true)
    expect(v.validate(makeRecord({ snapshot_version: 2 })).valid).toBe(true)
    expect(v.validate(makeRecord({ snapshot_version: 999 })).valid).toBe(false)
  })

  it('warns on suspicious created_at', () => {
    const result = validator.validate(makeRecord({ created_at: 0 }))
    expect(result.valid).toBe(true)
    expect(result.warnings.some(w => w.includes('created_at'))).toBe(true)
  })

  // ─═══ Cross-aggregate validation (Validator v2) ═══─

  describe('validateCrossAggregate', () => {
    it('passes for healthy cross-section', () => {
      const result = validator.validateCrossAggregate({
        snapshots: [
          makeRecord({ aggregate_id: 'trade', sequence: 100 }),
          makeRecord({ aggregate_id: 'wallet', sequence: 100 }),
        ],
      })
      expect(result.valid).toBe(true)
      expect(result.missingRuntimes).toHaveLength(0)
    })

    it('detects missing required runtime IDs', () => {
      const result = validator.validateCrossAggregate({
        snapshots: [
          makeRecord({ aggregate_id: 'trade', sequence: 100 }),
        ],
        requiredRuntimeIds: ['trade', 'wallet', 'risk'],
      })
      expect(result.valid).toBe(false)
      expect(result.missingRuntimes).toEqual(['wallet', 'risk'])
      expect(result.errors.some(e => e.includes('Required runtime'))).toBe(true)
    })

    it('rejects version above expected', () => {
      const result = validator.validateCrossAggregate({
        snapshots: [
          makeRecord({ aggregate_id: 'trade', snapshot_version: 3 }),
        ],
        expectedVersion: 2,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('exceeds current version'))).toBe(true)
    })

    it('rejects version below min compatible', () => {
      const result = validator.validateCrossAggregate({
        snapshots: [
          makeRecord({ aggregate_id: 'trade', snapshot_version: 0 }),
        ],
        minCompatibleVersion: 1,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('below minimum compatible'))).toBe(true)
    })

    it('warns on mixed versions', () => {
      const result = validator.validateCrossAggregate({
        snapshots: [
          makeRecord({ aggregate_id: 'trade', snapshot_version: 1 }),
          makeRecord({ aggregate_id: 'wallet', snapshot_version: 2 }),
        ],
      })
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('Mixed snapshot versions'))).toBe(true)
    })

    it('warns on large sequence gap between aggregates', () => {
      const result = validator.validateCrossAggregate({
        snapshots: [
          makeRecord({ aggregate_id: 'trade', sequence: 100 }),
          makeRecord({ aggregate_id: 'wallet', sequence: 50000 }),
        ],
      })
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('sequence gap'))).toBe(true)
    })

    it('adds per-snapshot validation results', () => {
      const result = validator.validateCrossAggregate({
        snapshots: [
          makeRecord({ aggregate_id: 'trade', snapshot_id: '' }),
          makeRecord({ aggregate_id: 'wallet', sequence: 100 }),
        ],
      })
      expect(result.perSnapshot['trade'].valid).toBe(false)
      expect(result.perSnapshot['wallet'].valid).toBe(true)
    })
  })
})
