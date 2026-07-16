// ── ParameterSpace — Collection of parameters with constraints ──
//
// @since 3.5.4

import type { ParameterDefinition as IPD, ParameterSpace as IPS } from '../types'
import { ParameterDefinition as ParameterDefinitionClass } from './ParameterDefinition'
import type { Constraint } from './Constraints'

export class ParameterSpace implements IPS {
  readonly parameters: ParameterDefinitionClass[]
  readonly constraints: Constraint[]

  constructor(
    params: IPD[],
    constraints: Constraint[] = [],
  ) {
    this.parameters = params.map(p => new ParameterDefinitionClass(p))
    this.constraints = constraints
  }

  /** Estimated total combinations */
  size(): number {
    if (this.parameters.length === 0) return 0
    let total = 1
    for (const p of this.parameters) {
      total *= p.gridSize
    }
    return total
  }

  /** Validate a full parameter set */
  validateAll(params: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const def of this.parameters) {
      if (params[def.id] === undefined) {
        errors.push(`Missing parameter: ${def.id}`)
        continue
      }
      if (!def.validate(params[def.id])) {
        errors.push(`Invalid value for '${def.id}': ${JSON.stringify(params[def.id])}`)
      }
    }

    for (const constraint of this.constraints) {
      if (!constraint.evaluate(params)) {
        errors.push(`Constraint violated: ${constraint.description}`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /** Find a parameter by id */
  get(id: string): ParameterDefinitionClass | undefined {
    return this.parameters.find(p => p.id === id)
  }

  /** Get parameter definition that gave the best score */
  importance(): string[] {
    return this.parameters.map(p => p.id)
  }
}
