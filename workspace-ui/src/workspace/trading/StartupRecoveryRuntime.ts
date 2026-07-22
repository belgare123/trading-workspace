// ── StartupRecoveryRuntime — startup state recovery ──
// Sprint 5.4 — Workspace Composition & Lifecycle
//
// Orchestrates recovery at startup:
//   1. Gateway.connect() (already connected by init)
//   2. Fetch open positions & orders from exchange
//   3. Recreate Trade objects (via RecoveryController)
//   4. Sync RiskRuntime (reset daily counters, re-evaluate)
//   5. Sync HistoryRuntime (restore session state)
//   6. Return RecoveryReport
//
// Uses the existing ExecutionRecoveryRuntime for low-level
// order/position reconciliation and RecoveryController for
// Trade object recreation.

import type { RecoveryReport } from './types'
import type { GatewayRuntime } from '../live/gateway/GatewayRuntime'
import type { RiskRuntime } from '../risk/runtime/RiskRuntime'

// ════════════════════════════════════════
// Dependencies
// ════════════════════════════════════════

export interface StartupRecoveryDeps {
  gateway: GatewayRuntime
  risk?: RiskRuntime
  /** Called to recreate Trade objects from recovered positions */
  recoverTrades?: () => Promise<{ recovered: number; warnings: string[]; errors: string[] }>
  /** Called to sync history after recovery */
  syncHistory?: () => Promise<{ warnings: string[]; errors: string[] }>
}

// ════════════════════════════════════════
// StartupRecoveryRuntime
// ════════════════════════════════════════

export class StartupRecoveryRuntime {
  private deps: StartupRecoveryDeps

  constructor(deps: StartupRecoveryDeps) {
    this.deps = deps
  }

  /**
   * Run the full recovery cycle.
   * Safe to call multiple times (reconnect, manual trigger).
   */
  async recover(): Promise<RecoveryReport> {
    const startTime = Date.now()
    const warnings: string[] = []
    const errors: string[] = []

    let recoveredTrades = 0
    let recoveredOrders = 0
    let recoveredPositions = 0

    try {
      // ── 1. Verify gateway connection ──
      if (!this.deps.gateway.isConnected()) {
        const err = new Error('Gateway is not connected — recovery aborted')
        errors.push(err.message)
        return {
          recoveredTrades: 0,
          recoveredOrders: 0,
          recoveredPositions: 0,
          warnings: [],
          errors,
          durationMs: Date.now() - startTime,
          healthy: false,
        }
      }

      // ── 2. Fetch broker state ──
      const [positions, orders] = await Promise.all([
        this.deps.gateway.getPositions().catch((err: Error) => {
          errors.push(`Failed to fetch positions: ${err.message}`)
          return []
        }),
        this.deps.gateway.getOrders({ status: 'open' }).catch((err: Error) => {
          errors.push(`Failed to fetch orders: ${err.message}`)
          return []
        }),
      ])

      recoveredPositions = positions.length
      recoveredOrders = orders.filter(
        (o: { status?: string }) => o.status === 'open' || o.status === 'new' || o.status === 'partially_filled'
      ).length

      if (recoveredPositions === 0 && recoveredOrders === 0) {
        // Nothing to recover — clean start
        return {
          recoveredTrades: 0,
          recoveredOrders: 0,
          recoveredPositions: 0,
          warnings: [],
          errors,
          durationMs: Date.now() - startTime,
          healthy: true,
        }
      }

      // ── 3. Recreate Trade objects ──
      if (this.deps.recoverTrades && recoveredPositions > 0) {
        const tradeResult = await this.deps.recoverTrades()
        recoveredTrades = tradeResult.recovered
        warnings.push(...tradeResult.warnings)
        errors.push(...tradeResult.errors)
      }

      if (recoveredPositions > 0 && recoveredTrades === 0 && errors.length === 0) {
        warnings.push(
          `${recoveredPositions} positions found but no Trade recovery handler provided — manual reconciliation may be needed`,
        )
      }

      // ── 4. Sync RiskRuntime ──
      if (this.deps.risk) {
        try {
          // Reset daily counters on restart (new day starts)
          if (typeof (this.deps.risk as any).resetDaily === 'function') {
            (this.deps.risk as any).resetDaily()
          }
          // Re-evaluate kill switch thresholds against current positions
          if (typeof (this.deps.risk as any).reevaluate === 'function') {
            await (this.deps.risk as any).reevaluate()
          }
        } catch (err) {
          warnings.push(`RiskRuntime sync warning: ${(err as Error).message}`)
        }
      }

      // ── 5. Sync HistoryRuntime ──
      if (this.deps.syncHistory) {
        try {
          const historyResult = await this.deps.syncHistory()
          warnings.push(...historyResult.warnings)
          errors.push(...historyResult.errors)
        } catch (err) {
          warnings.push(`HistoryRuntime sync warning: ${(err as Error).message}`)
        }
      }

      // ── 6. Build report ──
      const durationMs = Date.now() - startTime
      const healthy = errors.length === 0

      return {
        recoveredTrades,
        recoveredOrders,
        recoveredPositions,
        warnings,
        errors,
        durationMs,
        healthy,
      }
    } catch (err) {
      const durationMs = Date.now() - startTime
      return {
        recoveredTrades,
        recoveredOrders,
        recoveredPositions,
        warnings,
        errors: [...errors, `Recovery fatal error: ${(err as Error).message}`],
        durationMs,
        healthy: false,
      }
    }
  }
}
