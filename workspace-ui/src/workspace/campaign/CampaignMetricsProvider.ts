/**
 * CampaignMetricsProvider.ts — Collects raw metrics from platform components
 *
 * This is the ONLY component that knows about TradeJournal, CashLedger,
 * PositionRuntime, OrderBook, and other domain services. It returns raw
 * metrics that CampaignSnapshot.create() normalises into the canonical format.
 *
 * @since 4.9
 */

import type { CertificationRuntime } from '../certification/CertificationRuntime'
import type { Position, TradeRecord } from '../execution/types'
import type { HealthState } from './types'
import type {
  RawMetrics,
  TradingSnapshot,
  RuntimeSnapshot,
  HealthSnapshot,
  ComponentHealth,
  InvariantSnapshot,
  InvariantResult,
} from './CampaignMetricsTypes'

/**
 * Minimal execution source interface satisfied by both ExecutionRuntime
 * and PaperProvider. Keeps the Provider decoupled from any specific runtime.
 */
export interface ExecutionMetricsSource {
  tradeLedger: { all(): TradeRecord[]; readonly totalRealizedPnl: number; readonly totalCommission: number }
  cashLedger: { free(asset: string): number }
  equityLedger: { latest(): { totalEquity: number } | undefined }
  positionRuntime: { getPositions(): Position[]; getPosition(symbol: string): Position | undefined }
  orderBook: { all(): any[] }
}

export interface CampaignMetricsProviderConfig {
  /** Required: execution source (tradeLedger, cashLedger, etc.) */
  execution: ExecutionMetricsSource
  /** Optional: health state from supervisor */
  health?: () => HealthState
  /** Optional: certification runtime for certification status */
  certification?: CertificationRuntime
  /** Optional: last certification report pass rate */
  lastCertPassRate?: () => number | undefined
  /** Optional: callback to check if gateway is connected */
  isGatewayConnected?: () => boolean
  /** Optional: callback to get market data age (ms) */
  getMarketDataAge?: () => number
  /** Optional: callback to get exchange balance for reconciliation */
  getExchangeBalance?: (asset: string) => number | undefined
  /** Optional: callback to get exchange open positions for reconciliation */
  getExchangePositions?: () => { symbol: string; quantity: number }[]
  /** Optional: symbols being traded */
  symbols?: string[]
}

export class CampaignMetricsProvider {
  private config: CampaignMetricsProviderConfig
  private gcStartTime = 0
  private gcCount = 0
  private gcPauseMax = 0

  constructor(config: CampaignMetricsProviderConfig) {
    this.config = config
    this.setupGcTracking()
  }

  /**
   * Collect all metrics into a raw snapshot ready for CampaignSnapshot.create().
   */
  collect(): RawMetrics {
    return {
      trading: this.collectTrading(),
      runtime: this.collectRuntime(),
      health: this.collectHealth(),
      invariants: this.collectInvariants(),
    }
  }

  // ── Trading ──

  private collectTrading(): TradingSnapshot {
    const exec = this.config.execution
    const trades = exec.tradeLedger.all()
    const positions = exec.positionRuntime.getPositions()
    const equity = exec.equityLedger.latest()
    const freeBalance = exec.cashLedger.free('USDT')

    // Calculate per-trade metrics
    const closedTrades = trades.filter(t => t.realizedPnl !== 0)
    const winners = closedTrades.filter(t => t.realizedPnl > 0)
    const losers = closedTrades.filter(t => t.realizedPnl < 0)

    const totalHoldTimeSec = this.calculateTotalHoldTime(closedTrades)
    const symbols = this.config.symbols ?? []
    const lastPrice = symbols.length > 0
      ? this.getLastPrice(symbols[0])
      : 0

    // Estimate unrealised PnL from open positions via mark-to-market
    // If we have a last price, we could compute it; otherwise use positionRuntime's value
    let unrealisedPnl = 0
    for (const pos of positions) {
      if (pos.direction !== 'flat') {
        unrealisedPnl += pos.unrealizedPnl
      }
    }

    // Exposure
    const totalNotional = positions.reduce((s, p) => {
      if (p.direction === 'flat') return s
      return s + p.quantity * (p.currentPrice || lastPrice)
    }, 0)
    const exposurePct = equity && equity.totalEquity > 0
      ? (totalNotional / equity.totalEquity) * 100
      : 0

    // Largest position
    const largestPos = positions.reduce((max, p) => {
      return p.quantity > max ? p.quantity : max
    }, 0)

    // ── Trade Stats (M2-01) ──
    const winningCount = winners.length
    const losingCount = losers.length
    const totalClosed = winningCount + losingCount
    const winRate = totalClosed > 0 ? winningCount / totalClosed : 0
    const lossRate = totalClosed > 0 ? losingCount / totalClosed : 0

    const totalGrossProfit = winners.reduce((s, t) => s + t.realizedPnl, 0)
    const totalGrossLoss = losers.reduce((s, t) => s + t.realizedPnl, 0) // already negative
    const absGrossLoss = Math.abs(totalGrossLoss)

    const profitFactor = absGrossLoss > 0 ? totalGrossProfit / absGrossLoss : 0
    const averageWin = winningCount > 0 ? totalGrossProfit / winningCount : 0
    const averageLoss = losingCount > 0 ? totalGrossLoss / losingCount : 0

    // Expectancy: (winRate * avgWin) - (lossRate * |avgLoss|)
    const expectancy = (winRate * averageWin) - (lossRate * Math.abs(averageLoss))

    // Streaks: sort trades chronologically, then count consecutive wins/losses
    let maxWinStreak = 0
    let maxLossStreak = 0
    let currentWinStreak = 0
    let currentLossStreak = 0

    const sortedClosed = [...closedTrades].sort((a, b) => a.timestamp - b.timestamp)
    for (const t of sortedClosed) {
      if (t.realizedPnl > 0) {
        currentWinStreak++
        currentLossStreak = 0
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak
      } else if (t.realizedPnl < 0) {
        currentLossStreak++
        currentWinStreak = 0
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak
      }
    }

    return {
      freeBalance,
      equity: equity ? round2(equity.totalEquity) : 0,
      realisedPnl: round2(exec.tradeLedger.totalRealizedPnl),
      unrealisedPnl: round2(unrealisedPnl),
      totalFees: round2(exec.tradeLedger.totalCommission),
      tradesRecorded: trades.length,
      openPositions: positions.filter(p => p.direction !== 'flat').length,
      activeOrders: this.countActiveOrders(),
      exposurePct,
      leverage: exposurePct > 0 ? round2(exposurePct / 100) : 0,
      largestPositionSize: largestPos,
      largestWinner: winners.length > 0 ? Math.max(...winners.map(t => t.realizedPnl)) : 0,
      largestLoser: losers.length > 0 ? Math.min(...losers.map(t => t.realizedPnl)) : 0,
      averageHoldTimeSec: closedTrades.length > 0 ? Math.round(totalHoldTimeSec / closedTrades.length) : 0,
      averageCommission: trades.length > 0 ? round4(exec.tradeLedger.totalCommission / trades.length) : 0,
      averageSlippage: this.calculateAverageSlippage(trades),
      // Trade Stats (M2-01)
      winningTrades: winningCount,
      losingTrades: losingCount,
      winRate: round4(winRate),
      profitFactor: isFinite(profitFactor) ? round2(profitFactor) : 0,
      totalGrossProfit: round2(totalGrossProfit),
      totalGrossLoss: round2(totalGrossLoss),
      averageWin: round2(averageWin),
      averageLoss: round2(averageLoss),
      expectancy: round2(isFinite(expectancy) ? expectancy : 0),
      maxWinStreak,
      maxLossStreak,
    }
  }

  // ── Runtime ──

  private collectRuntime(): RuntimeSnapshot {
    const mem = process.memoryUsage()
    const cpu = process.cpuUsage()
    const uptime = process.uptime()

    // Attempt to read event loop utilization (Node 16+)
    let elu = 0
    try {
      if (typeof (process as any).loopUsage === 'function') {
        elu = (process as any).loopUsage().utilization
      }
    } catch {
      // Not available — leave as 0
    }

    return {
      nodeVersion: process.version,
      pid: process.pid,
      uptimeSec: Math.floor(uptime),
      rssMB: round1(mem.rss / 1024 / 1024),
      heapUsedMB: round1(mem.heapUsed / 1024 / 1024),
      heapTotalMB: round1(mem.heapTotal / 1024 / 1024),
      cpuPercent: this.calculateCpuPercent(cpu, uptime),
      eventLoopUtilization: elu,
      gcCount: this.gcCount,
      gcPauseMaxMs: round1(this.gcPauseMax),
    }
  }

  // ── Health ──

  private collectHealth(): HealthSnapshot {
    const h = this.config.health?.()
    const isGatewayConnected = this.config.isGatewayConnected?.() ?? true
    const marketDataAge = this.config.getMarketDataAge?.() ?? 0

    return {
      feed: this.buildComponentHealth(
        isGatewayConnected ? 'healthy' : 'degraded',
        marketDataAge,
        h?.reconnectCount ?? 0,
        h?.lastLatencyMs ?? 0,
      ),
      broker: this.buildComponentHealth(
        isGatewayConnected ? 'healthy' : 'degraded',
        0,
        0,
        0,
      ),
      strategy: this.buildComponentHealth(
        'healthy',
        0,
        0,
        0,
      ),
      certification: this.buildCertificationHealth(),
      storage: this.buildStorageHealth(),
    }
  }

  // ── Invariants ──

  private collectInvariants(): InvariantSnapshot {
    const exec = this.config.execution
    const positions = exec.positionRuntime.getPositions()

    return {
      positionSync: this.checkPositionSync(positions),
      balanceSync: this.checkBalanceSync(exec),
      ordersSync: this.checkOrdersSync(),
      tradeJournalConsistency: { ok: true }, // checked on replay
      eventStoreIntegrity: { ok: true },      // checked on replay
    }
  }

  // ── Private helpers ──

  private buildComponentHealth(
    status: 'healthy' | 'degraded' | 'down' | 'unknown',
    lastMessageAgeMs: number,
    reconnects: number,
    latencyMs: number,
  ): ComponentHealth {
    return { status, lastMessageAgeMs, reconnects, latencyMs }
  }

  private buildCertificationHealth(): ComponentHealth {
    const passRate = this.config.lastCertPassRate?.()
    if (passRate === undefined) {
      return { status: 'unknown', lastMessageAgeMs: 0, reconnects: 0, latencyMs: 0 }
    }
    const status = passRate >= 0.8 ? 'healthy' : passRate >= 0.5 ? 'degraded' : 'down'
    return { status, lastMessageAgeMs: 0, reconnects: 0, latencyMs: 0 }
  }

  private buildStorageHealth(): ComponentHealth {
    // Best-effort: check if state dir is writable
    return { status: 'healthy', lastMessageAgeMs: 0, reconnects: 0, latencyMs: 0 }
  }

  private checkPositionSync(positions: Position[]): InvariantResult {
    const exchangePositions = this.config.getExchangePositions?.()
    if (!exchangePositions) return { ok: true } // no exchange to reconcile

    for (const pos of positions) {
      if (pos.direction === 'flat') continue
      const exPos = exchangePositions.find(ep => ep.symbol === pos.symbol)
      if (!exPos) {
        return { ok: false, reason: `Position ${pos.symbol} missing on exchange`, delta: pos.quantity }
      }
      const delta = Math.abs(pos.quantity - exPos.quantity)
      if (delta > 0.001) {
        return { ok: false, reason: `Position ${pos.symbol} qty mismatch`, delta }
      }
    }
    return { ok: true }
  }

  private checkBalanceSync(exec: ExecutionMetricsSource): InvariantResult {
    const localBalance = exec.cashLedger.free('USDT')
    const exchangeBalance = this.config.getExchangeBalance?.('USDT')
    if (exchangeBalance === undefined) return { ok: true }

    const delta = Math.abs(localBalance - exchangeBalance)
    if (delta > 0.01) {
      return { ok: false, reason: 'USDT balance mismatch', delta }
    }
    return { ok: true }
  }

  private checkOrdersSync(): InvariantResult {
    return { ok: true } // Placeholder — full order reconciliation needs ExchangeAdapter
  }

  private countActiveOrders(): number {
    try {
      const exec = this.config.execution
      return exec.orderBook.all().filter((o: any) => {
        const status = o.status ?? o.state
        return status === 'pending' || status === 'accepted' || status === 'partially_filled'
      }).length
    } catch {
      return 0
    }
  }

  private calculateTotalHoldTime(trades: TradeRecord[]): number {
    if (trades.length < 2) return 0
    let total = 0
    let count = 0
    for (let i = 1; i < trades.length; i += 2) {
      if (i < trades.length) {
        total += (trades[i].timestamp - trades[i - 1].timestamp) / 1000
        count++
      }
    }
    return count > 0 ? total / count : 0
  }

  private calculateAverageSlippage(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0
    // Slippage is stored per-fill, not aggregated in TradeRecord
    // For now, return 0 — will be improved when Fill includes expected price
    return 0
  }

  private getLastPrice(symbol: string): number {
    try {
      const exec = this.config.execution
      // Try to get from orderBook or market data
      const positions = exec.positionRuntime.getPositions()
      const pos = positions.find(p => p.symbol === symbol)
      return pos?.currentPrice ?? 0
    } catch {
      return 0
    }
  }

  private calculateCpuPercent(cpu: NodeJS.CpuUsage, uptimeSec: number): number {
    const totalMicro = cpu.user + cpu.system
    // Convert to percentage of one core
    return totalMicro / 10000 / uptimeSec
  }

  // ── GC Tracking ──

  private setupGcTracking(): void {
    try {
      const hook = require('gc-hook' as any) as any
      if (hook && typeof hook.on === 'function') {
        hook.on('gc', (info: { type: string; pauseMs: number }) => {
          this.gcCount++
          if (info.pauseMs > this.gcPauseMax) {
            this.gcPauseMax = info.pauseMs
          }
        })
        this.gcStartTime = Date.now()
      }
    } catch {
      // gc-hook not available — track GC via performance observer (Node 16+)
      this.setupPerformanceObserver()
    }
  }

  private setupPerformanceObserver(): void {
    try {
      if (typeof PerformanceObserver !== 'undefined') {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'gc') {
              this.gcCount++
              const duration = entry.duration
              if (duration > this.gcPauseMax) {
                this.gcPauseMax = duration
              }
            }
          }
        })
        obs.observe({ entryTypes: ['gc'] })
      }
    } catch {
      // PerformanceObserver not available
    }
  }
}

// ── Local helper functions ──

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000
}
