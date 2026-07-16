// ── ParameterDefinition — Single parameter specification ──
//
// @since 3.5.4

import type { ParamType, ParameterDefinition as IPD } from '../types'

export class ParameterDefinition implements IPD {
  readonly id: string
  readonly name: string
  readonly type: ParamType
  readonly description?: string
  readonly default?: unknown
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly choices?: unknown[]

  constructor(def: IPD) {
    this.id = def.id
    this.name = def.name
    this.type = def.type
    this.description = def.description
    this.default = def.default
    this.min = def.min
    this.max = def.max
    this.step = def.step
    this.choices = def.choices
  }

  /** Validate a single value against this parameter's constraints */
  validate(value: unknown): boolean {
    switch (this.type) {
      case 'int':
        return Number.isInteger(value) && value !== null && (
          (this.min === undefined || (value as number) >= this.min) &&
          (this.max === undefined || (value as number) <= this.max)
        )
      case 'float':
        return typeof value === 'number' && Number.isFinite(value) && (
          (this.min === undefined || value >= this.min) &&
          (this.max === undefined || value <= this.max)
        )
      case 'choice':
        return this.choices?.includes(value) ?? false
      case 'boolean':
        return typeof value === 'boolean'
      default:
        return false
    }
  }

  /** Get possible values for grid search */
  gridValues(): unknown[] {
    switch (this.type) {
      case 'int': {
        if (this.min === undefined || this.max === undefined) return []
        const step = this.step ?? 1
        const values: number[] = []
        for (let v = this.min; v <= this.max; v += step) {
          values.push(v)
        }
        return values
      }
      case 'float': {
        if (this.min === undefined || this.max === undefined || this.step === undefined) return []
        const values: number[] = []
        for (let v = this.min; v <= this.max; v += this.step) {
          values.push(Math.round(v * 1e6) / 1e6)
        }
        return values
      }
      case 'choice':
        return this.choices ?? []
      case 'boolean':
        return [true, false]
      default:
        return []
    }
  }

  /** Count of discrete values for grid */
  get gridSize(): number {
    return this.gridValues().length
  }
}
