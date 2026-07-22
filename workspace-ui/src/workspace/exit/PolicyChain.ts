// ── PolicyChain — ordered chain of responsibility ──
// Sprint 5.5 — Exit Engine

import type { ExitPolicy } from './types'
import type { ExitDecision } from '../trade/runtime'
import type { TradeContext } from '../trade'

/**
 * PolicyChain runs policies in priority order.
 * First non-null ExitDecision wins.
 */
export class PolicyChain implements ExitPolicy {
  readonly id = 'policy-chain'
  private readonly policies: ExitPolicy[]

  constructor(policies: ExitPolicy[]) {
    if (!policies.length) throw new Error('PolicyChain requires at least one policy')
    this.policies = [...policies]
  }

  /** Add a policy at the end of the chain */
  add(policy: ExitPolicy): void {
    this.policies.push(policy)
  }

  /** Remove a policy by id */
  remove(id: string): void {
    const idx = this.policies.findIndex(p => p.id === id)
    if (idx >= 0) this.policies.splice(idx, 1)
  }

  /** List registered policies in order */
  list(): ReadonlyArray<ExitPolicy> {
    return [...this.policies]
  }

  evaluate(ctx: TradeContext): ExitDecision | null {
    for (const policy of this.policies) {
      const decision = policy.evaluate(ctx)
      if (decision) return decision
    }
    return null
  }
}
