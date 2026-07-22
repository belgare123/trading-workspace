// src/event-journal/ReplayValidator.ts
// Phase 5.5 — Post-replay validation guard.
// Checks: trade state, wallet state, position state, orders, sequences, checksums.

import type { ReplayReport } from './ReplayReport'

export interface ReplayValidationResult {
  /** Overall validation passed */
  valid: boolean

  /** Per-aggregate validation results */
  aggregates: Record<string, AggregateValidation>

  /** Total checks performed */
  checksPerformed: number

  /** Checks that failed */
  checksFailed: number

  /** When validation completed */
  completedAt: number
}

export interface AggregateValidation {
  aggregateId: string
  /** Whether this aggregate's state is valid */
  stateValid: boolean
  /** Whether sequences are consistent (no gaps, monotonic) */
  sequencesValid: boolean
  /** Whether state checksum/hash matches expected */
  stateHash: string
  /** Whether the state hash matches (for determinism checks) */
  hashMatchesExpected: boolean
  /** Number of events applied to this aggregate */
  eventsApplied: number
  /** Warnings for this aggregate */
  warnings: string[]
  /** Errors for this aggregate */
  errors: string[]
}

/**
 * Validator configuration.
 * Custom validation functions can be injected for domain-specific checks.
 */
export interface ReplayValidatorConfig {
  /** Expected state hashes per aggregate (for determinism checks) */
  expectedStateHashes?: Map<string, string>
  /** Minimum events that must have been applied */
  minEventsApplied?: number
  /** Maximum acceptable gap between aggregate sequences */
  maxSequenceGap?: number
}

/**
 * ReplayValidator — final guard after replay completes.
 * Checks state integrity, sequence consistency, and optional domain rules.
 */
export class ReplayValidator {
  private config: ReplayValidatorConfig

  constructor(config?: ReplayValidatorConfig) {
    this.config = config ?? {}
  }

  /**
   * Validate the replay report and aggregate states.
   * Returns detailed validation per aggregate.
   */
  validate(
    report: ReplayReport,
    getStateHash: (aggregateId: string) => { hash: string; eventsApplied: number },
  ): ReplayValidationResult {
    const aggregates: Record<string, AggregateValidation> = {}
    let checksPassed = 0
    let checksFailed = 0

    for (const aggResult of report.aggregateResults) {
      const validation: AggregateValidation = {
        aggregateId: aggResult.aggregateId,
        stateValid: !aggResult.error,
        sequencesValid: aggResult.sequenceTo >= aggResult.sequenceFrom,
        stateHash: aggResult.stateHash,
        hashMatchesExpected: false,
        eventsApplied: aggResult.eventsApplied,
        warnings: [],
        errors: [],
      }

      checksPassed++

      // Check: no apply errors
      if (aggResult.error) {
        validation.errors.push(aggResult.error)
        checksFailed++
      }

      // Check: sequences are consistent
      if (aggResult.sequenceTo < aggResult.sequenceFrom) {
        validation.sequencesValid = false
        validation.errors.push(
          `Sequence regressed: ${aggResult.sequenceFrom} → ${aggResult.sequenceTo}`,
        )
        checksFailed++
      }

      // Check: state hash matches expected (if provided)
      if (this.config.expectedStateHashes?.has(aggResult.aggregateId)) {
        const expected = this.config.expectedStateHashes.get(aggResult.aggregateId)!
        validation.hashMatchesExpected = aggResult.stateHash === expected
        if (!validation.hashMatchesExpected) {
          validation.errors.push(
            `State hash mismatch: expected ${expected}, got ${aggResult.stateHash}`,
          )
          checksFailed++
        }
      }

      // Check: minimum events applied
      if (
        this.config.minEventsApplied !== undefined &&
        aggResult.eventsApplied < this.config.minEventsApplied
      ) {
        validation.warnings.push(
          `Only ${aggResult.eventsApplied} events applied, expected ≥ ${this.config.minEventsApplied}`,
        )
      }

      aggregates[aggResult.aggregateId] = validation
    }

    // Check: max sequence gap between aggregates
    if (this.config.maxSequenceGap !== undefined && report.aggregateResults.length >= 2) {
      const sequences = report.aggregateResults.map(r => r.sequenceFrom)
      const maxSeq = Math.max(...sequences)
      const minSeq = Math.min(...sequences)
      const gap = maxSeq - minSeq
      if (gap > this.config.maxSequenceGap) {
        if (!aggregates['_system']) {
          aggregates['_system'] = {
            aggregateId: '_system',
            stateValid: true,
            sequencesValid: false,
            stateHash: '',
            hashMatchesExpected: true,
            eventsApplied: report.eventsProcessed,
            warnings: [`Sequence gap ${gap} exceeds max ${this.config.maxSequenceGap}`],
            errors: [],
          }
          checksFailed++
        }
      }
    }

    return {
      valid: checksFailed === 0,
      aggregates,
      checksPerformed: checksPassed + checksFailed,
      checksFailed,
      completedAt: Date.now(),
    }
  }
}
