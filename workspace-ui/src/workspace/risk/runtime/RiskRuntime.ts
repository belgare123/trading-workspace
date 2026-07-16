/**
 * RiskRuntime.ts — Central risk evaluation runtime
 *
 * Entry point for all pre-trade risk checks.
 * Lives between ActionRuntime and ExecutionGateway.
 *
 * Flow:
 *   sendOrder(order) → buildRiskContext → RiskPipeline.evaluate → RiskDecision
 *     → allow: pass to gateway
 *     → modify: adjust and pass to gateway
 *     → reject: return rejection with violations
 *
 * @since 4.7
 */

import type { RiskDecision, KillSwitchState } from '../types'
import type { OrderRequest } from '../../execution/types'
import { RiskRegistry } from '../registry/RiskRegistry'
import { RiskPipeline } from './RiskPipeline'
import { buildRiskContext, type RiskContextSource } from './RiskContext'
import { RiskViolationLog } from '../reports/RiskViolationLog'
import { RiskEventBus } from '../events/RiskEventBus'

export { RiskRegistry }
export { RiskPipeline }
export { RiskViolationLog }
export { RiskEventBus }

export class RiskRuntime {
  public readonly registry: RiskRegistry
  public readonly violations: RiskViolationLog
  public readonly events: RiskEventBus
  public readonly killSwitch: KillSwitchState = {
    active: false,
    triggeredBy: '',
    triggeredAt: 0,
    reason: '',
  }

  private source: RiskContextSource
  private mode: 'simulation' | 'paper' | 'live' = 'live'

  constructor(source: RiskContextSource, mode?: 'simulation' | 'paper' | 'live') {
    this.registry = new RiskRegistry()
    this.violations = new RiskViolationLog()
    this.events = new RiskEventBus()
    this.source = source
    if (mode) this.mode = mode
  }

  /** Set the data source for risk context building */
  setSource(source: RiskContextSource): void {
    this.source = source
  }

  setMode(mode: 'simulation' | 'paper' | 'live'): void {
    this.mode = mode
  }

  /** Evaluate an order against all enabled risk rules */
  async sendOrder(order: OrderRequest): Promise<RiskDecision> {
    // 1. Kill switch check
    if (this.killSwitch.active) {
      const decision: RiskDecision = {
        status: 'reject',
        violations: [{
          ruleId: 'kill_switch',
          ruleName: 'Kill Switch',
          severity: 'error',
          message: this.killSwitch.reason,
        }],
        warnings: [],
        score: 0,
      }
      this.events.emit('risk:reject', { order, decision })
      return decision
    }

    // 2. Build risk context
    const context = buildRiskContext(order, this.source, this.mode)

    // 3. Run pipeline
    const activeRules = this.registry.getActive()
    const result = await RiskPipeline.evaluate(activeRules, context)

    // 4. Log violation
    if (result.decision.violations.length > 0) {
      this.violations.log({
        timestamp: Date.now(),
        strategyId: order.strategyId,
        orderId: order.id,
        ruleId: result.rejectedBy ?? 'unknown',
        ruleName: result.rejectedBy ?? 'unknown',
        decision: result.decision.status,
        violations: result.decision.violations,
        score: result.decision.score,
      })
    }

    // 5. Emit event
    if (result.decision.status === 'reject') {
      this.events.emit('risk:reject', { order, decision: result.decision })
    } else if (result.decision.status === 'modify') {
      this.events.emit('risk:modify', { order, decision: result.decision })
    } else {
      this.events.emit('risk:allow', { order, decision: result.decision })
    }

    return result.decision
  }

  /** Simply check if an order would pass risk (no execution side effects) */
  async dryRun(order: OrderRequest): Promise<RiskDecision> {
    const context = buildRiskContext(order, this.source, this.mode)
    const activeRules = this.registry.getActive()
    const result = await RiskPipeline.evaluate(activeRules, context)
    return result.decision
  }

  // ── Kill Switch ──

  activateKillSwitch(reason: string, triggeredBy = 'manual'): void {
    this.killSwitch.active = true
    this.killSwitch.triggeredBy = triggeredBy
    this.killSwitch.triggeredAt = Date.now()
    this.killSwitch.reason = reason
    this.events.emit('risk:killswitch', { reason, triggeredBy })
  }

  deactivateKillSwitch(): void {
    this.killSwitch.active = false
    this.killSwitch.triggeredBy = ''
    this.killSwitch.triggeredAt = 0
    this.killSwitch.reason = ''
    this.events.emit('risk:killswitch_off', {})
  }

  // ── Stats ──

  get stats(): { totalRules: number; activeRules: number; violationCount: number } {
    return {
      totalRules: this.registry.size,
      activeRules: this.registry.getActive().length,
      violationCount: this.violations.count(),
    }
  }
}
