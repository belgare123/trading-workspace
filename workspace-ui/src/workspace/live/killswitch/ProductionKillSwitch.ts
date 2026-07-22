/**
 * ProductionKillSwitch.ts — Emergency stop for live trading
 *
 * Monitors account risk thresholds in real time. On breach:
 *   1. Cancel all open orders
 *   2. Close all open positions (reduce-only market orders)
 *   3. Block new order placement via RiskRuntime
 *
 * Can also be triggered manually via trigger().
 *
 * @since 4.9E
 * @system Production Kill Switch
 */

import type { BybitExecutionGateway } from '../gateway/BybitExecutionGateway'
import type { RiskRuntime } from '../../risk/runtime/RiskRuntime'

// ── Configuration ──

export interface KillSwitchThresholds {
  /** Max drawdown from peak equity (%). 0 = disabled. */
  maxDrawdownPercent: number
  /** Max daily loss as % of start-of-day equity. 0 = disabled. */
  maxDailyLossPercent: number
  /** Max concurrent open positions. 0 = disabled. */
  maxPositionCount: number
}

export interface KillSwitchActions {
  cancelOrders: boolean
  closePositions: boolean
  blockNewOrders: boolean
}

export interface KillSwitchConfig {
  thresholds: KillSwitchThresholds
  actions: KillSwitchActions
  /** Monitoring interval in ms. 0 = no auto-monitoring (manual only). */
  intervalMs: number
}

const DEFAULTS: KillSwitchConfig = {
  thresholds: {
    maxDrawdownPercent: 20,
    maxDailyLossPercent: 10,
    maxPositionCount: 5,
  },
  actions: {
    cancelOrders: true,
    closePositions: true,
    blockNewOrders: true,
  },
  intervalMs: 30_000,
}

// ── Production Kill Switch ──

export class ProductionKillSwitch {
  private gateway: BybitExecutionGateway
  private riskRuntime: RiskRuntime | null = null

  private config: KillSwitchConfig
  private timer: ReturnType<typeof setInterval> | null = null

  // Tracking state
  private triggered = false
  private peakEquity = 0
  private startOfDayEquity = 0
  private lastCheckDay = 0

  // External callbacks
  public onTrigger: ((reason: string, details: string[]) => void) | null = null
  public onCheck: ((equity: number, positions: number) => void) | null = null
  public onError: ((error: Error) => void) | null = null

  constructor(
    gateway: BybitExecutionGateway,
    config?: Partial<KillSwitchConfig>,
  ) {
    this.gateway = gateway
    this.config = {
      ...DEFAULTS,
      ...config,
      thresholds: { ...DEFAULTS.thresholds, ...config?.thresholds },
      actions: { ...DEFAULTS.actions, ...config?.actions },
    }
  }

  /** Attach a RiskRuntime so blockNewOrders can take effect */
  attachRiskRuntime(runtime: RiskRuntime): void {
    this.riskRuntime = runtime
  }

  /** Get the effective kill switch config (live) */
  getConfig(): KillSwitchConfig {
    return { ...this.config }
  }

  // ── Lifecycle ──

  /** Start monitoring loop (no-op if already running or intervalMs=0) */
  start(): void {
    if (this.timer) return
    if (this.config.intervalMs <= 0) return

    this.triggered = false
    this.refreshPeakEquity()

    this.timer = setInterval(() => {
      this.check().catch((err) => {
        this.onError?.(err instanceof Error ? err : new Error(String(err)))
      })
    }, this.config.intervalMs)
  }

  /** Stop monitoring loop */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** True if the kill switch has been triggered this session */
  isTriggered(): boolean {
    return this.triggered
  }

  // ── Trigger / Deactivate ──

  /**
   * Manual or auto trigger. Performs configured actions:
   *   1. cancelAllOrders
   *   2. close positions via reduce-only market orders
   *   3. set RiskRuntime.killSwitch.active = true
   */
  async trigger(reason: string): Promise<void> {
    if (this.triggered) return
    this.triggered = true
    const details: string[] = []

    // Stop monitoring once triggered
    this.stop()

    // 1. Cancel all open orders
    if (this.config.actions.cancelOrders) {
      try {
        const count = await this.gateway.cancelAllOrders()
        details.push(`Cancelled ${count} order(s)`)
      } catch (err) {
        details.push(`Cancel error: ${(err as Error).message}`)
      }
    }

    // 2. Close all open positions (via reduce-only market orders)
    if (this.config.actions.closePositions) {
      try {
        const positions = await this.gateway.getPositions()
        const posArray = Array.isArray(positions) ? positions : []
        let closed = 0
        for (const pos of posArray) {
          if (!pos.quantity || pos.quantity <= 0) continue
          try {
            await this.gateway.placeOrder({
              id: `kill-${Date.now()}-${pos.symbol}`,
              strategyId: 'kill-switch',
              symbol: pos.symbol,
              side: pos.direction === 'long' ? 'sell' : 'buy',
              type: 'market',
              quantity: pos.quantity,
              reduceOnly: true,
              timeInForce: 'IOC',
              timestamp: Date.now(),
            })
            closed++
          } catch (err) {
            details.push(`Close ${pos.symbol} error: ${(err as Error).message}`)
          }
        }
        details.push(`Closed ${closed}/${posArray.length} position(s)`)
      } catch (err) {
        details.push(`Position close error: ${(err as Error).message}`)
      }
    }

    // 3. Block new orders via RiskRuntime
    if (this.config.actions.blockNewOrders && this.riskRuntime) {
      this.riskRuntime.killSwitch.active = true
      this.riskRuntime.killSwitch.reason = reason
      this.riskRuntime.killSwitch.triggeredAt = Date.now()
      this.riskRuntime.killSwitch.triggeredBy = 'ProductionKillSwitch'
      details.push('Trading blocked')
    }

    this.onTrigger?.(reason, details)
  }

  /** Deactivate — re-enables trading if previously blocked */
  deactivate(): void {
    this.triggered = false
    if (this.riskRuntime) {
      this.riskRuntime.killSwitch.active = false
      this.riskRuntime.killSwitch.reason = ''
      this.riskRuntime.killSwitch.triggeredAt = 0
      this.riskRuntime.killSwitch.triggeredBy = ''
    }
    // Restart monitoring
    this.start()
  }

  // ── Private: Monitoring ──

  private async check(): Promise<void> {
    // Fetch latest account state from gateway
    // Fetch latest account state from gateway
    await this.gateway.refresh()

    const account = this.gateway.getAccount('default')
    const equity = account?.totalEquity ?? 0

    // Reset start-of-day equity on day change
    const today = new Date().getUTCDate()
    if (today !== this.lastCheckDay) {
      this.startOfDayEquity = equity
      this.lastCheckDay = today
    }
    if (this.startOfDayEquity <= 0) this.startOfDayEquity = equity

    // Track peak equity
    if (equity > this.peakEquity) this.peakEquity = equity

    // Get position count
    const positions = await this.gateway.getPositions()
    const activeCount = Array.isArray(positions) ? positions.filter((p) => p.quantity > 0).length : 0

    this.onCheck?.(equity, activeCount)

    // Evaluate thresholds
    const breaches: string[] = []
    const { maxDrawdownPercent, maxDailyLossPercent, maxPositionCount } = this.config.thresholds

    if (maxDrawdownPercent > 0 && this.peakEquity > 0 && equity > 0) {
      const dd = ((this.peakEquity - equity) / this.peakEquity) * 100
      if (dd >= maxDrawdownPercent) {
        breaches.push(
          `drawdown ${dd.toFixed(1)}% >= ${maxDrawdownPercent}% (peak ${this.peakEquity.toFixed(4)})`,
        )
      }
    }

    if (maxDailyLossPercent > 0 && this.startOfDayEquity > 0 && equity > 0) {
      const dailyLoss = ((this.startOfDayEquity - equity) / this.startOfDayEquity) * 100
      if (dailyLoss >= maxDailyLossPercent) {
        breaches.push(`daily loss ${dailyLoss.toFixed(1)}% >= ${maxDailyLossPercent}%`)
      }
    }

    if (maxPositionCount > 0 && activeCount > maxPositionCount) {
      breaches.push(`positions ${activeCount} > ${maxPositionCount}`)
    }

    if (breaches.length > 0) {
      await this.trigger(`Auto: ${breaches.join('; ')}`)
    }
  }

  private refreshPeakEquity(): void {
    const account = this.gateway.getAccount('default')
    if (account) {
      this.peakEquity = account.totalEquity
      this.startOfDayEquity = account.totalEquity
      this.lastCheckDay = new Date().getUTCDate()
    }
  }
}
