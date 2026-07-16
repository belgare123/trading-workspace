// ── Constraints — Inter-parameter constraint definitions ──
//
// @since 3.5.4

import type { Constraint as IC } from '../types'

export class Constraint implements IC {
  readonly id: string
  readonly description: string
  private _evaluate: (params: Record<string, unknown>) => boolean

  constructor(id: string, description: string, evaluate: (params: Record<string, unknown>) => boolean) {
    this.id = id
    this.description = description
    this._evaluate = evaluate
  }

  evaluate(params: Record<string, unknown>): boolean {
    return this._evaluate(params)
  }
}

// ── Built-in constraint factories ──

/** One parameter must be strictly less than another */
export function lessThan(idA: string, idB: string, label?: string): Constraint {
  return new Constraint(
    `lt_${idA}_${idB}`,
    label ?? `${idA} < ${idB}`,
    (p) => (p[idA] as number) < (p[idB] as number),
  )
}

/** One parameter must be less than or equal to another */
export function lessOrEqual(idA: string, idB: string, label?: string): Constraint {
  return new Constraint(
    `le_${idA}_${idB}`,
    label ?? `${idA} <= ${idB}`,
    (p) => (p[idA] as number) <= (p[idB] as number),
  )
}

/** One parameter must equal a specific value */
export function equals(id: string, value: unknown, label?: string): Constraint {
  return new Constraint(
    `eq_${id}`,
    label ?? `${id} == ${value}`,
    (p) => p[id] === value,
  )
}

/** Parameter must be in a set */
export function oneOf(id: string, values: unknown[], label?: string): Constraint {
  return new Constraint(
    `in_${id}`,
    label ?? `${id} ∈ {${values.join(',')}}`,
    (p) => values.includes(p[id]),
  )
}

/** Custom constraint builder */
export function constraint(
  id: string,
  description: string,
  evaluate: (params: Record<string, unknown>) => boolean,
): Constraint {
  return new Constraint(id, description, evaluate)
}
