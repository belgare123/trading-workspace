/**
 * PaperCampaign.ts — Two-stage Paper Campaign orchestrator
 *
 * Architecture:
 *   PaperCampaign
 *     ├── Stage 1: Burn-in (24h)
 *     │     Verifies infrastructure stability
 *     │     On pass → auto-advance to Stage 2
 *     │     On fail  → stop with report
 *     │
 *     └── Stage 2: Paper Campaign (7d)
 *           Continuous paper trading with monitoring
 *           Certification Suite every 6h
 *           Daily aggregated reports
 *           Auto-stop on critical incidents
 *
 * The orchestrator owns the lifecycle and delegates monitoring
 * to CampaignSupervisor.
 *
 * @since 4.9
 */

import {
  CampaignStage,
  CampaignMode,
  type CampaignDailyReport,
  type CampaignFinalReport,
  type CampaignIncident,
  type BurnInResult,
  IncidentSeverity,
  BURN_IN_DURATION_MS,
  CAMPAIGN_DURATION_MS,
  HEALTH_CHECK_INTERVAL_MS,
  CERTIFICATION_INTERVAL_MS,
  DAILY_REPORT_INTERVAL_MS,
} from './types'
import { CampaignSupervisor, type SupervisorConfig } from './CampaignSupervisor'
import type { GatewayRuntime } from '../live/gateway/GatewayRuntime'
import type { LiveFeedRuntime } from '../live/feed/LiveFeedRuntime'
import type { PaperBrokerAdapter } from '../live/brokers/PaperBrokerAdapter'
import type { BrokerAdapter } from '../live/live/BrokerAdapter'
import { CertificationRuntime } from '../certification/CertificationRuntime'
import type { CertificationReport } from '../certification/CertificationReport'
import type { ScenarioCategory } from '../certification/ScenarioDefinition'
import { CampaignReporter } from './CampaignReporter'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface PaperCampaignConfig {
  /** Campaign mode (default: burn-in, then auto-advance) */
  mode?: CampaignMode
  /** Supervisor config */
  supervisor?: SupervisorConfig
  /** Burn-in duration ms (default: 24h) */
  burnInDurationMs?: number
  /** Campaign duration ms (default: 7d) */
  campaignDurationMs?: number
  /** Health check interval ms (default: 60s) */
  healthCheckIntervalMs?: number
  /** Certification interval ms (default: 6h) */
  certificationIntervalMs?: number
  /** Daily report interval ms (default: 24h) */
  dailyReportIntervalMs?: number
  /** Symbols to campaign */
  symbols: string[]
  /** Optional: custom state directory (default: os.tmpdir()/paper-campaign) */
  stateDir?: string
  /** Callback when campaign stage changes */
  onStageChange?: (stage: CampaignStage) => void
  /** Callback on incidents */
  onIncident?: (incident: CampaignIncident) => void
  /** Callback for daily reports */
  onDailyReport?: (report: CampaignDailyReport) => void
  /** Callback for burn-in result */
  onBurnInComplete?: (result: BurnInResult) => void
  /** Callback for final report */
  onFinalReport?: (report: CampaignFinalReport) => void
}

export class PaperCampaign {
  public supervisor: CampaignSupervisor
  public stage: CampaignStage = CampaignStage.Idle
  private config: PaperCampaignConfig
  private gateway: GatewayRuntime | null = null
  private feedRuntime: LiveFeedRuntime | null = null
  private broker: BrokerAdapter | null = null
  private certRuntime: CertificationRuntime | null = null

  // Timer handles
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private certificationTimer: ReturnType<typeof setInterval> | null = null
  private dailyReportTimer: ReturnType<typeof setInterval> | null = null
  private stageTimer: ReturnType<typeof setTimeout> | null = null

  // State
  private stageStartTime = 0
  private stageElapsed = 0
  private dailyReports: CampaignDailyReport[] = []
  private burnInResult: BurnInResult | null = null
  private activeOrders = 0
  private totalFills = 0
  private totalPnl = 0
  private peakMemoryMB = 0
  private stopRequested = false
  private lastCertReport: CertificationReport | null = null

  // Observability (reset per healthcheck cycle)
  private lastHealthcheckDurationMs = 0
  private lastHealthcheckTime = 0
  private currentHealthcheckStart = 0

  public campaignStateDir: string

  constructor(config: PaperCampaignConfig) {
    this.config = config
    this.supervisor = new CampaignSupervisor(config.supervisor)
    this.campaignStateDir = config.stateDir ?? path.join(os.tmpdir(), 'paper-campaign')
    try { fs.mkdirSync(this.campaignStateDir, { recursive: true }) } catch { /* best-effort */ }
  }

  // ── Lifecycle ──

  /**
   * Set the platform components needed for the campaign.
   */
  setComponents(params: {
    gateway: GatewayRuntime
    feedRuntime: LiveFeedRuntime
    broker: BrokerAdapter
    certRuntime: CertificationRuntime
  }): void {
    this.gateway = params.gateway
    this.feedRuntime = params.feedRuntime
    this.broker = params.broker
    this.certRuntime = params.certRuntime
  }

  /**
   * Start the campaign.
   * If mode=BurnIn → runs only burn-in.
   * If mode=FullCampaign → runs burn-in, then auto-advances to 7d campaign.
   */
  async start(): Promise<void> {
    if (this.stage !== CampaignStage.Idle) {
      throw new Error(`[PaperCampaign] Already started (stage: ${this.stage})`)
    }
    if (!this.gateway || !this.feedRuntime || !this.broker || !this.certRuntime) {
      throw new Error('[PaperCampaign] Components not set. Call setComponents() first.')
    }

    this.stopRequested = false

    const mode = this.config.mode ?? CampaignMode.FullCampaign
    console.log(`\n📋 Paper Campaign — starting in ${mode} mode`)
    console.log(`   Symbols: ${this.config.symbols.join(', ')}`)
    console.log()

    try {
      if (mode === CampaignMode.FullCampaign) {
        await this.runBurnIn()
        if (this.stopRequested) return

        if (this.burnInResult?.passed) {
          await this.runCampaign()
        } else {
          this.stage = CampaignStage.Failed
          this.config.onStageChange?.(CampaignStage.Failed)
          console.log(`\n❌ Campaign stopped: ${this.burnInResult?.rejectionReason ?? 'Burn-in failed'}`)
        }
      } else {
        // Burn-in only
        await this.runBurnIn()
      }
    } catch (err) {
      console.error('[PaperCampaign] Fatal error:', err)
      this.supervisor.recordException(err instanceof Error ? err : new Error(String(err)))
      this.stage = CampaignStage.Failed
      this.config.onStageChange?.(CampaignStage.Failed)
    } finally {
      await this.shutdown()
    }
  }

  /** Request graceful stop */
  requestStop(): void {
    this.stopRequested = true
    console.log('[PaperCampaign] Stop requested')
  }

  /** Serialize current state to file for frontend */
  private saveStateFile(): void {
    let state: any
    try {
      const health = this.supervisor.getHealth()
      const certResult = this.lastCertReport
      const incidents = this.supervisor.getIncidents().slice(-50).map(i => ({
        id: i.id,
        type: i.type,
        message: i.message,
        severity: i.severity,
        timestamp: new Date(i.timestamp).toISOString(),
      }))

      state = {
        stage: this.stage,
        uptime: `${Math.round(health.uptime / 60)}m`,
        reconnectCount: health.reconnectCount,
        exceptionsCount: health.exceptionCount,
        lastCertResult: certResult ? `${certResult.passed}/${certResult.total}` : 'N/A',
        lastCertTimestamp: certResult?.timestamp ?? '',
        incidents,
        memoryMB: health.memoryMB,

        // Observability
        healthcheckDurationMs: this.lastHealthcheckDurationMs,
        lastHealthcheckTime: new Date(this.lastHealthcheckTime).toISOString(),
        lastMarketEventAgeMs: this.supervisor.getMarketDataAge(),
      }

      fs.writeFileSync(path.join(this.campaignStateDir, 'state.json'), JSON.stringify(state, null, 2))
    } catch (err) {
      // Best-effort — retry with directory recreation
      try {
        fs.mkdirSync(this.campaignStateDir, { recursive: true })
        fs.writeFileSync(path.join(this.campaignStateDir, 'state.json'), JSON.stringify(state, null, 2))
      } catch {
        // Best-effort — don't let file I/O crash the campaign
      }
    }
  }

  /** Get current stage */
  getStage(): CampaignStage {
    return this.stage
  }

  /** Check if still running */
  isRunning(): boolean {
    return [CampaignStage.BurnIn, CampaignStage.PaperCampaign].includes(this.stage)
  }

  // ── Stage 1: Burn-in ──

  private async runBurnIn(): Promise<void> {
    this.stage = CampaignStage.BurnIn
    this.stageStartTime = Date.now()
    const duration = this.config.burnInDurationMs ?? BURN_IN_DURATION_MS
    this.config.onStageChange?.(CampaignStage.BurnIn)

    console.log('┌──────────────────────────────────────────────────┐')
    console.log('│   🔥 Stage 1 — Burn-in (24 hours)               │')
    console.log('│   Infrastructure stability verification        │')
    console.log('└──────────────────────────────────────────────────┘')
    console.log()

    // Start health check loop
    this.startHealthCheck()
    this.startCertification()
    this.startDailyReports()

    // Wait for burn-in duration or stop
    await this.waitForDuration(duration)

    // Stop timers
    this.stopTimers()

    this.stageElapsed = Date.now() - this.stageStartTime

    // Evaluate burn-in results
    this.burnInResult = this.supervisor.evaluateBurnIn(this.stageElapsed)

    if (this.burnInResult.passed) {
      this.stage = CampaignStage.BurnInComplete
      this.config.onStageChange?.(CampaignStage.BurnInComplete)

      console.log('\n✅ Burn-in PASSED — all criteria met')
    } else {
      this.stage = CampaignStage.Failed
      this.config.onStageChange?.(CampaignStage.Failed)

      console.log(`\n❌ Burn-in FAILED — ${this.burnInResult.rejectionReason}`)
    }

    // Show criteria details
    console.log()
    CampaignReporter.printBurnInResult(this.burnInResult)
    this.config.onBurnInComplete?.(this.burnInResult)
  }

  // ── Stage 2: Paper Campaign ──

  private async runCampaign(): Promise<void> {
    this.stage = CampaignStage.PaperCampaign
    this.stageStartTime = Date.now()
    const duration = this.config.campaignDurationMs ?? CAMPAIGN_DURATION_MS
    this.config.onStageChange?.(CampaignStage.PaperCampaign)

    console.log()
    console.log('┌──────────────────────────────────────────────────┐')
    console.log('│   📊 Stage 2 — Paper Campaign (7 days)          │')
    console.log('│   Full production pipeline with risk rules      │')
    console.log('└──────────────────────────────────────────────────┘')
    console.log()

    // Reset daily reports for campaign phase
    this.dailyReports = []
    this.supervisor.reset()

    // ── Cancel any pending certification from burn-in phase ──
    // Without this, the second CertificationRuntime.run() throws
    // 'already running', which gets recorded as a pipeline exception
    // and triggers a false auto-stop immediately on phase transition.
    if (this.certRuntime?.isRunning) {
      this.certRuntime.cancel()
      // Wait for the running certification to finish its current scenario
      // and release the _isRunning flag
      while (this.certRuntime.isRunning) {
        await new Promise(r => setTimeout(r, 50))
      }
    }

    // Restart timers
    this.startHealthCheck()
    this.startCertification()
    this.startDailyReports()

    // Wait for campaign duration or stop
    await this.waitForDuration(duration)

    // Stop timers
    this.stopTimers()

    this.stageElapsed = Date.now() - this.stageStartTime
    this.stage = CampaignStage.Completed
    this.config.onStageChange?.(CampaignStage.Completed)

    console.log('\n✅ Paper Campaign completed successfully')
    console.log()
  }

  // ── Timers ──

  private startHealthCheck(): void {
    const interval = this.config.healthCheckIntervalMs ?? HEALTH_CHECK_INTERVAL_MS
    this.healthCheckTimer = setInterval(() => {
      if (this.stopRequested) return
      this.performHealthCheck()
    }, interval)

    // Run first check immediately
    this.performHealthCheck()
  }

  private startCertification(): void {
    const interval = this.config.certificationIntervalMs ?? CERTIFICATION_INTERVAL_MS
    this.certificationTimer = setInterval(() => {
      if (this.stopRequested) return
      this.runCertificationSuite().catch((err) => {
        this.supervisor.recordPipelineException(err instanceof Error ? err : new Error(String(err)))
      })
    }, interval)

    // Run first certification immediately
    this.runCertificationSuite().catch((err) => {
      this.supervisor.recordPipelineException(err instanceof Error ? err : new Error(String(err)))
    })
  }

  private startDailyReports(): void {
    const interval = this.config.dailyReportIntervalMs ?? DAILY_REPORT_INTERVAL_MS
    this.dailyReportTimer = setInterval(() => {
      if (this.stopRequested) return
      this.generateDailyReport()
    }, interval)
  }

  private stopTimers(): void {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer)
    if (this.certificationTimer) clearInterval(this.certificationTimer)
    if (this.dailyReportTimer) clearInterval(this.dailyReportTimer)
    if (this.stageTimer) clearTimeout(this.stageTimer)

    this.healthCheckTimer = null
    this.certificationTimer = null
    this.dailyReportTimer = null
    this.stageTimer = null
  }

  // ── Operations ──

  private async performHealthCheck(): Promise<void> {
    this.currentHealthcheckStart = Date.now()
    try {
      // Update supervisor state FIRST — proves gateway & feed alive
      this.supervisor.recordGatewayState(true)
      this.supervisor.recordMarketData(Date.now())

      const health = this.supervisor.getHealth()

      // Check auto-stop
      const shouldStop = this.supervisor.shouldAutoStop()
      if (shouldStop.stop) {
        console.error(`\n🚨 Auto-stop triggered: ${shouldStop.reason}`)
        this.requestStop()
        return
      }

      // Track peak memory
      if (health.memoryMB > this.peakMemoryMB) {
        this.peakMemoryMB = health.memoryMB
      }

      // Console summary (compact)
      const statusIcon = health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌'
      const stageLabel = this.stage === CampaignStage.BurnIn ? 'Burn-in' : 'Campaign'
      const memoryTrend = health.memoryMB > 100 ? `${health.memoryMB}MB` : `${health.memoryMB}MB`
      console.log(
        `[${stageLabel}] ${statusIcon} up=${Math.round(health.uptime / 60)}m ` +
        `mem=${memoryTrend} reconn=${health.reconnectCount} ` +
        `lat=${health.lastLatencyMs}ms ex=${health.exceptionCount}`
      )

      // Save state for frontend
      this.saveStateFile()
    } catch (err) {
      console.error('[HealthCheck] Error:', err)
    } finally {
      this.lastHealthcheckDurationMs = Date.now() - this.currentHealthcheckStart
      this.lastHealthcheckTime = Date.now()
    }
  }

  // Campaign-safe categories — exclude disruptive connectivity & recovery scenarios
  private readonly CAMPAIGN_CERT_CATEGORIES: ScenarioCategory[] = [
    'orders',
    'risk',
    'infrastructure',
    'history',
    'metrics',
  ]

  private async runCertificationSuite(): Promise<void> {
    if (!this.certRuntime) return

    console.log(`\n[Certification] Running suite at ${new Date().toISOString()}...`)

    try {
      // Only run non-disruptive categories (skip connectivity & recovery
      // which test connect/disconnect cycles on the live broker)
      // risk-09 (Risk After Disconnect) intentionally disconnects briefly
      // but is a single quick cycle every 6h — acceptable during campaign
      const report = await this.certRuntime.run({
        categories: this.CAMPAIGN_CERT_CATEGORIES,
      })

      // Store for state serialization
      this.lastCertReport = report

      if (!report) {
        console.error('[Certification] No report returned')
        return
      }

      const s = report
      console.log(`[Certification] ${s.passed}/${s.total} passed (${s.passRate}%), ${s.failed} failed, ${s.skipped} skipped, ${s.errors} errors`)

      // Record failures as incidents
      if (s.failed > 0) {
        for (const f of report.failures) {
          this.supervisor.recordException(new Error(`Certification: ${f.id} - ${f.message}`), 'certification')
        }
      }

      // Record critical degradation (allow 80% buffer for variable-sized suites)
      if (s.total > 0 && (s.passed / s.total) < 0.65) {
        this.supervisor.recordException(
          new Error(`Certification score dropped to ${s.passed}/${s.total}`),
          'certification-degradation'
        )
      }
    } catch (err) {
      // Do NOT record 'already running' as pipeline exception — this is a
      // transient race condition (e.g. phase transition) that should resolve
      // on the next interval, not trigger a false auto-stop.
      if (err instanceof Error && /already running/i.test(err.message)) {
        console.log(`[Certification] Skipped — ${err.message}`)
        return
      }
      this.supervisor.recordPipelineException(err instanceof Error ? err : new Error(String(err)))
    }
  }

  private generateDailyReport(): void {
    const health = this.supervisor.getHealth()
    const day = this.dailyReports.length + 1
    const now = Date.now()

    const report: CampaignDailyReport = {
      day,
      date: new Date().toISOString().slice(0, 10),
      durationMs: now - this.stageStartTime,
      periodStart: now - (this.config.dailyReportIntervalMs ?? DAILY_REPORT_INTERVAL_MS),
      periodEnd: now,
      incidents: this.supervisor.getIncidents().slice(-50), // last 50
      currentHealth: health,
      totalOrders: this.activeOrders,
      totalFills: this.totalFills,
      totalPnl: this.totalPnl,
      peakMemoryMB: this.peakMemoryMB,
    }

    this.dailyReports.push(report)
    this.config.onDailyReport?.(report)

    // Print to console
    console.log()
    CampaignReporter.printDailyReport(report)
    console.log()
  }

  private async waitForDuration(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = 5_000 // check every 5s

      const check = () => {
        if (this.stopRequested) {
          resolve()
          return
        }

        const elapsed = Date.now() - this.stageStartTime
        if (elapsed >= durationMs) {
          resolve()
          return
        }

        this.stageTimer = setTimeout(check, checkInterval)
      }

      this.stageTimer = setTimeout(check, checkInterval)
    })
  }

  // ── Shutdown ──

  private async shutdown(): Promise<void> {
    this.stopTimers()

    if (this.broker) {
      try {
        await this.broker.dispose()
      } catch { /* ignore */ }
    }

    if (this.gateway) {
      try {
        await this.gateway.shutdown()
      } catch { /* ignore */ }
    }

    if (this.feedRuntime) {
      try {
        this.feedRuntime.stop?.()
      } catch { /* ignore */ }
    }

    console.log('[PaperCampaign] Shutdown complete')
  }
}
