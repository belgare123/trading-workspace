/**
 * FailureScenario.ts — Timeline-based chaos scenario definition
 *
 * A scenario is a sequence of timed steps that inject failures,
 * switch profiles, or wait for system reactions.
 *
 * Timeline example:
 *   T=0s    normal
 *   T=60s   Latency 5s (scope=ORDERS)
 *   T=90s   Packet loss 30%
 *   T=150s  Disconnect (scope=PRIVATE_WS)
 *   T=170s  Reconnect
 *   T=200s  Clear all
 *
 * Every scenario using the same seed produces identical random results.
 *
 * @since 6.6
 */

import type { InjectionRule } from './InjectionRule'
import type { FailureProfile } from './FailureProfile'
import { FailureInjectionScope } from './InjectionRule'

export type ScenarioAction =
  | { type: 'inject'; rule: InjectionRule }
  | { type: 'clear'; ruleId?: string }
  | { type: 'clear_all' }
  | { type: 'switch_profile'; profile: string | FailureProfile }
  | { type: 'wait'; durationMs: number }
  | { type: 'assert'; condition: string; timeoutMs: number }

export interface ScenarioStep {
  /** Milliseconds from scenario start */
  at: number
  action: ScenarioAction
  description?: string
}

export interface FailureScenario {
  readonly id: string
  readonly description: string
  readonly steps: ScenarioStep[]
  readonly seed?: number
}

// ── Builder for ergonomic timeline construction ──

export class ScenarioBuilder {
  private steps: ScenarioStep[] = []
  private currentTime = 0

  /** Advance the timeline by `ms` milliseconds */
  wait(ms: number): this {
    this.currentTime += ms
    return this
  }

  /** Set absolute time pointer (for non-linear construction) */
  at(ms: number): this {
    this.currentTime = ms
    return this
  }

  /** Inject a failure rule at current timeline position */
  inject(rule: InjectionRule, description?: string): this {
    this.steps.push({
      at: this.currentTime,
      action: { type: 'inject', rule },
      description,
    })
    return this
  }

  /** Clear a specific rule by id */
  clear(ruleId: string, description?: string): this {
    this.steps.push({
      at: this.currentTime,
      action: { type: 'clear', ruleId },
      description,
    })
    return this
  }

  /** Clear all active rules */
  clearAll(description?: string): this {
    this.steps.push({
      at: this.currentTime,
      action: { type: 'clear_all' },
      description,
    })
    return this
  }

  /** Switch to a different profile */
  switchProfile(profile: string | FailureProfile, description?: string): this {
    this.steps.push({
      at: this.currentTime,
      action: { type: 'switch_profile', profile },
      description,
    })
    return this
  }

  /** Build the scenario */
  build(id: string, description: string, seed?: number): FailureScenario {
    return {
      id,
      description,
      steps: [...this.steps],
      seed,
    }
  }
}
