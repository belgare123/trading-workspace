// src/event-journal/SnapshotValidator.ts
// Phase 4.6 — Validator v2: integrity + schema version + migration compat + runtime IDs + missing aggregate detection

import type { SnapshotSerializer } from './SnapshotSerializer'
import { SnapshotChecksumError } from './SnapshotSerializer'

export interface SnapshotRecord {
  snapshot_id: string
  aggregate_id: string
  sequence: number
  snapshot_version: number
  checksum: string | null
  last_applied_sequence: number | null
  created_at: number
  payload: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface CrossAggregateValidationInput {
  /** All snapshot records to validate as a set */
  snapshots: SnapshotRecord[]
  /** Expected snapshot version. Default: current (2) */
  expectedVersion?: number
  /** Minimum compatible snapshot version for migration reads. Default: 1 */
  minCompatibleVersion?: number
  /** Runtime IDs that MUST be present for recovery to be valid (e.g. ['trade', 'wallet', 'risk']) */
  requiredRuntimeIds?: string[]
}

export interface CrossAggregateValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  /** Which required runtime IDs are missing from the snapshot set */
  missingRuntimes: string[]
  /** Map of aggregate_id → per-snapshot validation result */
  perSnapshot: Record<string, ValidationResult>
}

/**
 * SnapshotValidator v2
 *
 * Single-snapshot validation (backward compatible):
 *   - structural integrity (required fields)
 *   - version compatibility
 *   - sequence vs last_applied_sequence consistency
 *   - checksum verification
 *
 * Cross-aggregate validation (new in v2):
 *   - migration compatibility across versions
 *   - required runtime IDs presence check
 *   - missing aggregate detection
 *   - consistency across all loaded snapshots
 */
export class SnapshotValidator {
  private serializer: SnapshotSerializer
  private supportedVersions: Set<number>

  constructor(serializer: SnapshotSerializer, supportedVersions?: number[]) {
    this.serializer = serializer
    this.supportedVersions = new Set(supportedVersions ?? [1, 2])
  }

  /**
   * Validate a single snapshot record (v1-compatible API)
   */
  validate(record: SnapshotRecord): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Structural
    if (!record.snapshot_id) errors.push('Missing snapshot_id')
    if (!record.aggregate_id) errors.push('Missing aggregate_id')
    if (!Number.isInteger(record.sequence) || record.sequence < 0) {
      errors.push(`Invalid sequence: ${record.sequence}`)
    }
    if (record.created_at <= 0) warnings.push(`Suspicious created_at: ${record.created_at}`)

    // 2. Version
    const version = record.snapshot_version ?? 1
    if (!this.supportedVersions.has(version)) {
      errors.push(`Unsupported snapshot version ${version}. Supported: [${[...this.supportedVersions].join(', ')}]`)
    }

    // 3. Consistency: sequence vs last_applied_sequence
    if (record.last_applied_sequence !== null) {
      if (record.last_applied_sequence < record.sequence) {
        warnings.push(
          `last_applied_sequence (${record.last_applied_sequence}) < sequence (${record.sequence}). ` +
          'This may indicate events were applied after snapshot creation.'
        )
      }
      if (record.last_applied_sequence > 0 && record.sequence === 0) {
        warnings.push('Events have been applied (last_applied_sequence > 0) but snapshot sequence is 0')
      }
    }

    // 4. Checksum
    if (record.checksum) {
      try {
        this.serializer.deserialize({
          data: record.payload,
          checksum: record.checksum,
          algorithm: 'none',
        })
      } catch (err) {
        if (err instanceof SnapshotChecksumError) {
          errors.push(err.message)
        } else {
          errors.push(`Snapshot payload parse error: ${(err as Error).message}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Quick integrity check — lightweight, no payload parse
   */
  quickCheck(record: SnapshotRecord): boolean {
    return (
      !!record.snapshot_id &&
      !!record.aggregate_id &&
      Number.isInteger(record.sequence) &&
      record.sequence >= 0 &&
      this.supportedVersions.has(record.snapshot_version ?? 1)
    )
  }

  /**
   * Cross-aggregate validation (new in v2):
   * Validates consistency across all snapshots loaded for recovery.
   *
   * Checks:
   *   - Schema version compatibility across all snapshots
   *   - Migration compatibility (can v2 engine read v1 snapshots?)
   *   - Required runtime IDs presence
   *   - Missing aggregate detection
   */
  validateCrossAggregate(input: CrossAggregateValidationInput): CrossAggregateValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const missingRuntimes: string[] = []
    const perSnapshot: Record<string, ValidationResult> = {}

    const expectedVersion = input.expectedVersion ?? 2
    const minCompatible = input.minCompatibleVersion ?? 1

    // Validate each snapshot individually
    for (const snap of input.snapshots) {
      perSnapshot[snap.aggregate_id] = this.validate(snap)
    }

    // Migration compatibility check
    const versionsInUse = new Set(input.snapshots.map(s => s.snapshot_version ?? 1))
    for (const v of versionsInUse) {
      if (v > expectedVersion) {
        errors.push(
          `Snapshot version ${v} exceeds current version ${expectedVersion}. ` +
          'Downgrade path not supported.'
        )
      }
      if (v < minCompatible) {
        errors.push(
          `Snapshot version ${v} is below minimum compatible version ${minCompatible}. ` +
          'Migration from this version is not supported.'
        )
      }
    }

    // Track incompatible version mix
    if (versionsInUse.size > 1) {
      warnings.push(
        `Mixed snapshot versions detected: [${[...versionsInUse].join(', ')}]. ` +
        'All snapshots will be migrated to current version on next save.'
      )
    }

    // Required runtime IDs / missing aggregate detection
    const presentIds = new Set(input.snapshots.map(s => s.aggregate_id))
    if (input.requiredRuntimeIds) {
      for (const requiredId of input.requiredRuntimeIds) {
        if (!presentIds.has(requiredId)) {
          missingRuntimes.push(requiredId)
          errors.push(
            `Required runtime '${requiredId}' has no snapshot. ` +
            'Recovery will need full journal replay for this aggregate.'
          )
        }
      }
    }

    // Cross-aggregate sequence consistency
    const sequences = input.snapshots.map(s => s.sequence)
    if (sequences.length > 1) {
      const maxSeq = Math.max(...sequences)
      const minSeq = Math.min(...sequences)
      if (maxSeq - minSeq > 1000) {
        warnings.push(
          `Large sequence gap between snapshots: min=${minSeq}, max=${maxSeq}. ` +
          'Some aggregates may be significantly behind others.'
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      missingRuntimes,
      perSnapshot,
    }
  }
}
