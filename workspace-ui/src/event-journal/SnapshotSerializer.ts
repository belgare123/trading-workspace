// src/event-journal/SnapshotSerializer.ts
// Compression/decompression + CRC32 checksum for snapshot payloads

import { createHash } from 'crypto'
import { deflateSync, inflateSync } from 'zlib'

export interface SnapshotSerializerConfig {
  /** Enable compression for new snapshots. Default false (can always decompress). */
  compressionEnabled?: boolean
  /** Compression level (1–9). Default 6. Only used when compressionEnabled=true. */
  compressionLevel?: number
}

export interface SerializedSnapshot {
  data: string
  checksum: string
  algorithm: 'none' | 'gzip'
}

/**
 * Handles compression and checksumming of snapshot payloads.
 * The serializer stores the checksum alongside the snapshot; on retrieval
 * it verifies integrity before returning the data.
 */
export class SnapshotSerializer {
  private config: Required<SnapshotSerializerConfig>

  constructor(config: SnapshotSerializerConfig = {}) {
    this.config = {
      compressionEnabled: config.compressionEnabled ?? false,
      compressionLevel: config.compressionLevel ?? 6,
    }
  }

  /** Serialize and optionally compress + checksum a state object */
  serialize(state: unknown): SerializedSnapshot {
    const json = JSON.stringify(state)

    if (this.config.compressionEnabled) {
      const compressed = this.compress(json)
      const checksum = this.sha256Hex(compressed)
      return { data: compressed, checksum, algorithm: 'gzip' }
    }

    const checksum = this.sha256Hex(json)
    return { data: json, checksum, algorithm: 'none' }
  }

  /** Deserialize — verify checksum, decompress if needed, parse JSON */
  deserialize(snapshot: SerializedSnapshot): unknown {
    const { data, checksum, algorithm } = snapshot

    // Verify checksum
    const actualChecksum = this.sha256Hex(data)
    if (actualChecksum !== checksum) {
      throw new SnapshotChecksumError(
        `Checksum mismatch: expected ${checksum}, got ${actualChecksum}`
      )
    }

    // Decompress if needed
    const json = algorithm === 'gzip' ? this.decompress(data) : data

    return JSON.parse(json)
  }

  /** SHA-256 hex digest */
  sha256Hex(input: string): string {
    return createHash('sha256').update(input, 'utf-8').digest('hex')
  }

  /** CRC32 hex digest (lighter alternative) */
  crc32Hex(input: string): string {
    // CRC32 via Node.js CRC (available natively)
    const buf = Buffer.from(input, 'utf-8')
    return crc32Buffer(buf).toString(16).padStart(8, '0')
  }

  get compressionActive(): boolean {
    return this.config.compressionEnabled
  }

  // ─── Compression helpers ───

  private compress(text: string): string {
    const compressed = deflateSync(Buffer.from(text, 'utf-8'), { level: this.config.compressionLevel })
    return compressed.toString('base64')
  }

  private decompress(data: string): string {
    const decompressed = inflateSync(Buffer.from(data, 'base64'))
    return decompressed.toString('utf-8')
  }
}

export class SnapshotChecksumError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnapshotChecksumError'
  }
}

/**
 * CRC-32 computation using a lookup table.
 * Pure JS — no native deps needed.
 */
function crc32Buffer(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    const index = (crc ^ buf[i]) & 0xFF
    crc = (crc >>> 8) ^ CRC32_TABLE[index]
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

const CRC32_TABLE: number[] = (() => {
  const table: number[] = new Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c
  }
  return table
})()
