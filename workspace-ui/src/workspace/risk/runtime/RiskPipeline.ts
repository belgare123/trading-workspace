/**
 * RiskPipeline.ts — Sequential rule evaluation with stop-on-reject
 *
 * Evaluates enabled risk rules in order. If any rule returns 'reject',
 * the pipeline short-circuits and returns the rejection immediately.
 * If a rule returns 'modify', the modified order is passed to the next rule.
 *
 * @since 4.7
 */

import type { RiskDecision, RiskContext, RiskViolation } from '../types'
import type { RiskRuleDefinition } from '../definition/RiskDefinition'
import type { RiskRuleConfig } from '../types'

export interface PipelineResult {
  /** Final decision after all rules */
  decision: RiskDecision
  /** How many rules were evaluated */
  evaluated: number
  /** Which rule (if any) short-circuited */
  rejectedBy?: string
}

export class RiskPipeline {
  /**
   * Evaluate all rules sequentially against the given context.
   * Returns the final decision, which is one of:
   * - 'allow' after all rules pass
   * - 'modify' if a rule modified the order
   * - 'reject' at the first rejecting rule
   */
  static async evaluate(
    rules: { definition: RiskRuleDefinition; config: RiskRuleConfig }[],
    context: RiskContext,
  ): Promise<PipelineResult> {
    let currentContext = { ...context }
    let evaluated = 0
    let hasModifications = false

    for (const { definition, config } of rules) {
      if (!config.enabled) continue

      evaluated++

      const result = await definition.evaluate(currentContext, config)

      // Collect violations
      const allViolations: RiskViolation[] = [
        ...currentContext.previousViolations,
        ...result.violations,
      ]

      switch (result.status) {
        case 'reject':
          return {
            decision: {
              ...result,
              violations: allViolations,
            },
            evaluated,
            rejectedBy: definition.id,
          }

        case 'modify': {
          hasModifications = true
          // Pass the modified order to the next rule
          const modifiedOrder = result.order ?? currentContext.order
          currentContext = {
            ...currentContext,
            order: modifiedOrder,
            previousViolations: allViolations,
          }
          break
        }

        case 'allow':
        default:
          currentContext = {
            ...currentContext,
            previousViolations: allViolations,
          }
          break
      }
    }

    // All rules passed
    const finalWarnings = currentContext.previousViolations.filter(v => v.severity === 'warning' || v.severity === 'info')

    return {
      decision: {
        status: hasModifications ? 'modify' : 'allow',
        order: currentContext.order,
        violations: currentContext.previousViolations.filter(v => v.severity === 'error'),
        warnings: finalWarnings,
        score: hasModifications ? 0.7 : 1.0,
        modifications: hasModifications ? { quantity: currentContext.order.quantity } : undefined,
      },
      evaluated,
    }
  }
}
