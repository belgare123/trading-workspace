// ── EmergencyPolicy — drawdown, time, kill-switch exits ──
// Sprint 5.5 — Exit Engine

import type { ExitPolicy } from './types'
import type { EmergencyPolicyConfig } from './types'
import type { TradeContext } from '../trade'
import { ExitReason } from '../trade'
import { POLICY_PRIORITY } from './types'

export class EmergencyPolicy implements ExitPolicy {
  readonly id = 'emergency'
  private readonly config: EmergencyPolicyConfig

  constructor(config: Partial<EmergencyPolicyConfig> = {}) {
    this.config = {
      maxDrawdownPct: config.maxDrawdownPct ?? -0.15,
      maxTradeAgeMs: config.maxTradeAgeMs ?? 86_400_000, // 24h
      respectKillSwitch: config.respectKillSwitch ?? true,
    }
  }

  evaluate(ctx: TradeContext): ExitDecision | null {
    const { trade, risk, market } = ctx

    // 1. Kill switch
    if (this.config.respectKillSwitch && risk.isKillSwitchActive) {
      return {
        reason: ExitReason.EmergencyExit,
        exitPrice: market.price,
        exitType: 'market',
        quantity: 'all',
        priority: POLICY_PRIORITY.EMERGENCY,
      }
    }

    // 2. Max drawdown (portfolio level)
    if (risk.drawdown <= this.config.maxDrawdownPct) {
      return {
        reason: ExitReason.EmergencyExit,
        exitPrice: market.price,
        exitType: 'market',
        quantity: 'all',
        priority: POLICY_PRIORITY.EMERGENCY,
      }
    }

    // 3. Max trade age
    const age = trade.timestamps.openedAt ? Date.now() - trade.timestamps.openedAt : 0
    if (age > this.config.maxTradeAgeMs) {
      return {
        reason: ExitReason.TimeExit,
        exitPrice: market.price,
        exitType: 'market',
        quantity: 'all',
        priority: POLICY_PRIORITY.TIME_EXIT,
      }
    }

    return null
  }
}
