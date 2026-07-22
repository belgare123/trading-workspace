// ── ExitEngine — IExitEngine implementation with PolicyChain ──
// Sprint 5.5 — Exit Engine

import type { IExitEngine, ExitDecision } from '../trade/runtime'
import type { TradeContext } from '../trade'
import type { ExitPolicy } from './types'
import { PolicyChain } from './PolicyChain'
import { ROIPolicy } from './ROIPolicy'
import { StopLossPolicy } from './StopLossPolicy'
import { TrailingPolicy } from './TrailingPolicy'
import { EmergencyPolicy } from './EmergencyPolicy'
import type { ExitEngineConfig } from './types'

/**
 * ExitEngine — evaluates all exit policies and returns the winning decision.
 *
 * Default policy order (priority, lower = evaluated first):
 *   1. Emergency (kill-switch, drawdown, max age)
 *   2. Stop Loss (fixed%, ATR, price level)
 *   3. Trailing Stop (activation + distance)
 *   4. Take Profit (ROI thresholds)
 */
export class ExitEngine implements IExitEngine {
  readonly chain: PolicyChain
  readonly policies: {
    roi?: ROIPolicy
    stopLoss?: StopLossPolicy
    trailing?: TrailingPolicy
    emergency?: EmergencyPolicy
  } = {}

  constructor(config?: ExitEngineConfig) {
    const policies: ExitPolicy[] = []

    // 1. Emergency
    if (config?.emergency) {
      this.policies.emergency = new EmergencyPolicy(config.emergency)
      policies.push(this.policies.emergency)
    }

    // 2. Stop loss
    if (config?.stopLoss) {
      this.policies.stopLoss = new StopLossPolicy(config.stopLoss)
      policies.push(this.policies.stopLoss)
    }

    // 3. Trailing
    if (config?.trailing) {
      this.policies.trailing = new TrailingPolicy(config.trailing)
      policies.push(this.policies.trailing)
    }

    // 4. ROI / take profit
    if (config?.roi) {
      this.policies.roi = new ROIPolicy(config.roi)
      policies.push(this.policies.roi)
    }

    // Always include emergency at minimum
    if (!policies.length) {
      this.policies.emergency = new EmergencyPolicy()
      policies.push(this.policies.emergency)
    }

    this.chain = new PolicyChain(policies)
  }

  evaluate(context: TradeContext): ExitDecision | null {
    return this.chain.evaluate(context)
  }
}
