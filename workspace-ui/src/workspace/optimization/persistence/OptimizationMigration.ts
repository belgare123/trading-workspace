// ── OptimizationMigration — Schema migration for optimization state ──
//
// @since 3.5.4

import type { OptimizationState } from './OptimizationSerializer'

export class OptimizationMigration {
  /** Check if migration is needed */
  needsMigration(state: OptimizationState): boolean {
    return state.version !== '3.5.4'
  }

  /** Migrate from any old version to latest */
  migrate(state: OptimizationState): OptimizationState {
    let current = { ...state }

    // Future migrations:
    // if (current.version === '3.5.3') { current = migrate_3_5_3_to_3_5_4(current) }

    current.version = '3.5.4'
    return current
  }

  /** Validate state integrity */
  validate(state: OptimizationState): string[] {
    const errors: string[] = []

    if (!state.session) errors.push('Missing session info')
    if (!state.session?.id) errors.push('Missing session id')
    if (!Array.isArray(state.trials)) errors.push('Trials must be an array')

    return errors
  }
}
