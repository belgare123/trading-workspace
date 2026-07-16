// ── ParameterGenerator — Generate parameter value sets from ParameterSpace ──
//
// @since 3.5.4

import type { ParameterSpace, BacktestConfig } from '../types'
import { ParameterDefinition } from './ParameterDefinition'

export class ParameterGenerator {
  /** Generate all combinations (grid) */
  static *grid(space: ParameterSpace): Generator<Record<string, unknown>> {
    const defs = space.parameters
    if (defs.length === 0) return

    // Convert to ParameterDefinition class instances to use gridValues()
    const pd = defs.map(d => d instanceof ParameterDefinition ? d : new ParameterDefinition(d as any))
    const grids = pd.map(p => p.gridValues())
    if (grids.some(g => g.length === 0)) return

    const indices = new Array(defs.length).fill(0)

    while (true) {
      const params: Record<string, unknown> = {}
      for (let i = 0; i < defs.length; i++) {
        params[defs[i].id] = grids[i][indices[i]]
      }

      // Check constraints
      if (space.constraints.length === 0 || space.constraints.every(c => c.evaluate(params))) {
        yield params
      }

      // Advance
      let carry = true
      for (let i = defs.length - 1; i >= 0 && carry; i--) {
        indices[i]++
        if (indices[i] >= grids[i].length) {
          indices[i] = 0
        } else {
          carry = false
        }
      }
      if (carry) break
    }
  }

  /** Generate random parameter sets */
  static *random(space: ParameterSpace, count: number): Generator<Record<string, unknown>> {
    const rng = () => Math.random()

    for (let n = 0; n < count; n++) {
      const params: Record<string, unknown> = {}
      for (const def of space.parameters) {
        params[def.id] = this.randomValue(def, rng)
      }

      if (space.constraints.every(c => c.evaluate(params))) {
        yield params
      } else {
        n-- // retry
        if (n > count * 10) break // safety
      }
    }
  }

  /** Generate Latin Hypercube samples */
  static *latinHypercube(space: ParameterSpace, count: number): Generator<Record<string, unknown>> {
    const n = space.parameters.length
    if (n === 0) return

    // Generate LHS indices
    const buckets: number[][] = Array.from({ length: count }, () => [])
    for (let i = 0; i < n; i++) {
      const perm = Array.from({ length: count }, (_, k) => k).sort(() => Math.random() - 0.5)
      for (let j = 0; j < count; j++) {
        buckets[j].push(perm[j])
      }
    }

    const rng = () => Math.random()
    for (let j = 0; j < count; j++) {
      const params: Record<string, unknown> = {}
      for (let i = 0; i < n; i++) {
        const def = space.parameters[i]
        const bucket = buckets[j][i]
        const t = (bucket + rng()) / count

        params[def.id] = this.sampleUniform(def, t)
      }

      if (space.constraints.every(c => c.evaluate(params))) {
        yield params
      }
    }
  }

  private static randomValue(def: { id: string; type: string; min?: number; max?: number; step?: number; choices?: unknown[] }, rng: () => number): unknown {
    const t = rng()
    return this.sampleUniform(def, t)
  }

  private static sampleUniform(def: { id: string; type: string; min?: number; max?: number; step?: number; choices?: unknown[] }, t: number): unknown {
    switch (def.type) {
      case 'int': {
        if (def.min === undefined || def.max === undefined) return 0
        const step = def.step ?? 1
        const steps = Math.floor((def.max - def.min) / step)
        return def.min + Math.floor(t * steps) * step
      }
      case 'float': {
        if (def.min === undefined || def.max === undefined) return 0
        return def.min + t * (def.max - def.min)
      }
      case 'choice': {
        const choices = def.choices ?? []
        return choices[Math.floor(t * choices.length)]
      }
      case 'boolean':
        return t > 0.5
      default:
        return 0
    }
  }

  /** Fill a base config with generated parameters */
  static applyToConfig(base: BacktestConfig, params: Record<string, unknown>): BacktestConfig {
    return {
      ...base,
      id: `${base.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      strategyParams: {
        ...base.strategyParams,
        ...params,
      },
    }
  }
}
