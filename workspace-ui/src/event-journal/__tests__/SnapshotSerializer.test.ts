// __tests__/SnapshotSerializer.test.ts

import { describe, it, expect } from 'vitest'
import { SnapshotSerializer, SnapshotChecksumError } from '../SnapshotSerializer'

describe('SnapshotSerializer', () => {
  const serializer = new SnapshotSerializer()

  it('serializes state to JSON without compression by default', () => {
    const state = { balance: 1000, symbol: 'XRPUSDT' }
    const result = serializer.serialize(state)
    expect(result.algorithm).toBe('none')
    expect(result.checksum).toBeTruthy()
    expect(result.data).toBe(JSON.stringify(state))
  })

  it('deserializes back to original state', () => {
    const state = { balance: 1000, symbol: 'XRPUSDT' }
    const serialized = serializer.serialize(state)
    const deserialized = serializer.deserialize(serialized)
    expect(deserialized).toEqual(state)
  })

  it('detects checksum tampering', () => {
    const state = { balance: 1000 }
    const serialized = serializer.serialize(state)
    // Tamper with the data
    const tampered = { ...serialized, checksum: '0000000000000000000000000000000000000000000000000000000000000000' }
    expect(() => serializer.deserialize(tampered)).toThrow(SnapshotChecksumError)
  })

  it('CRC32 produces consistent results', () => {
    const h1 = serializer.crc32Hex('hello')
    const h2 = serializer.crc32Hex('hello')
    expect(h1).toBe(h2)
    expect(h1.length).toBe(8) // 32 bits = 8 hex chars
  })

  it('SHA-256 produces consistent results', () => {
    const h1 = serializer.sha256Hex('hello')
    const h2 = serializer.sha256Hex('hello')
    expect(h1).toBe(h2)
    expect(h1.length).toBe(64) // 256 bits = 64 hex chars
  })

  it('different inputs produce different hashes', () => {
    const h1 = serializer.sha256Hex('hello')
    const h2 = serializer.sha256Hex('world')
    expect(h1).not.toBe(h2)
  })

  it('compression flag is reflected', () => {
    const s1 = new SnapshotSerializer()
    expect(s1.compressionActive).toBe(false)
    const s2 = new SnapshotSerializer({ compressionEnabled: true })
    expect(s2.compressionActive).toBe(true)
  })

  it('handles large nested objects', () => {
    const state = {
      trades: Array.from({ length: 100 }, (_, i) => ({
        id: `trade-${i}`,
        symbol: 'XRPUSDT',
        qty: Math.random() * 1000,
        price: Math.random() * 2,
      })),
    }
    const serialized = serializer.serialize(state)
    const deserialized = serializer.deserialize(serialized)
    expect(deserialized).toEqual(state)
  })

  it('handles empty state', () => {
    const serialized = serializer.serialize({})
    const deserialized = serializer.deserialize(serialized)
    expect(deserialized).toEqual({})
  })

  it('handles null state values', () => {
    const state = { value: null, items: [] }
    const serialized = serializer.serialize(state)
    const deserialized = serializer.deserialize(serialized)
    expect(deserialized).toEqual(state)
  })
})

describe('SnapshotSerializer with compression', () => {
  const serializer = new SnapshotSerializer({ compressionEnabled: true })

  it('sets algorithm to gzip when compression enabled', () => {
    const state = { items: Array.from({ length: 5000 }, (_, i) => ({ index: i, value: 'x'.repeat(50), data: { a: 1, b: 2 } })) }
    const serialized = serializer.serialize(state)
    const uncompressed = JSON.stringify(state)
    expect(serialized.algorithm).toBe('gzip')
    expect(serialized.data.length).toBeLessThan(uncompressed.length)
  })

  it('round-trips through compression', () => {
    const state = { items: Array.from({ length: 100 }, (_, i) => ({ index: i, value: `item-${i}` })) }
    const serialized = serializer.serialize(state)
    const deserialized = serializer.deserialize(serialized)
    expect(deserialized).toEqual(state)
  })

  it('detects checksum tampering with compressed data', () => {
    const state = { data: 'sensitive' }
    const serialized = serializer.serialize(state)
    const tampered = { ...serialized, checksum: 'bad' }
    expect(() => serializer.deserialize(tampered)).toThrow(SnapshotChecksumError)
  })
})
