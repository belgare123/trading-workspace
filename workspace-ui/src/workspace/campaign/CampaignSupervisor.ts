/**
 * CampaignSupervisor.ts — Watchdog for Paper Campaign lifecycle
 *
 * Tracks:
 *   - process restarts (count + window)
 *   - reconnect count
 *   - health state (memory, CPU, latency, exceptions)
 *   - incident log with severity
 *   - auto-stop criteria
 *   - burn-in pass/fail criteria
 *
 * The supervisor DOES NOT own the campaign lifecycle; that's PaperCampaign.
 * It provides pure state + decision logic.
 *
 * @since 4.9
 */

import {
  type HealthState,
  type CampaignIncident,
  type BurnInResult,
  IncidentSeverity,
  AUTO_STOP_CRITERIA,
  BURN_IN_CRITERIA_LABELS,
  MAX_RECONNECT_ATTEMPTS,
  RESTART_THRESHOLD,
  RESTART_WINDOW_MS,
  MARKET_DATA_STALL_MS,
  MEMORY_GROWTH_THRESHOLD_PCT,
  BURN_IN_DURATION_MS,
  HEALTH_CHECK_INTERVAL_MS,
} from './types'

export interface SupervisorConfig {
  /** Max allowed reconnects before auto-stop (default: 10) */
  maxReconnects?: number
  /** Restart threshold within window (default: 3 in 5min) */
  restartThreshold?: number
  /** Restart tracking window ms (default: 5min) */
  restartWindowMs?: number
  /** Market data stall threshold ms (default: 60s) */
  marketDataStallMs?: number
  /** Memory growth threshold % per hour (default: 15%) */
  memoryGrowthThresholdPct?: number
}

export class CampaignSupervisor {
  // ── Restart tracking ──
  private restartTimestamps: number[] = []
  private restartCount = 0

  // ── Reconnect tracking ──
  private reconnectCount = 0
  private lastReconnectTime = 0

  // ── Memory tracking ──
  private memorySamples: { time: number; mb: number }[] = []

  // ── Exception tracking ──
  private exceptionCount = 0

  // ── Position sync ──
  private desyncCount = 0
  private lostPositionCount = 0

  // ── Market data ──
  private lastMarketDataTime = 0

  // ── Gateway ──
  private gatewayConnected = false

  // ── Pipeline exceptions ──
  private pipelineExceptionCount = 0

  // ── Incidents ──
  private incidents: CampaignIncident[] = []

  // ── Status ──
  private status: 'healthy' | 'degraded' | 'critical' | 'stopped' = 'healthy'
  private startTime = Date.now()
  private crashCount = 0

  // ── Latency tracking ──
  private latencySamples: number[] = []
  private lastLatency = 0

  private incidentCounter = 0

  constructor(private config: SupervisorConfig = {}) {}

  // ── Observers (called by PaperCampaign) ──

  /** Record a process restart */
  recordRestart(): void {
    this.restartCount++
    this.crashCount++
    const now = Date.now()
    this.restartTimestamps.push(now)

    // Purge old entries outside window
    const cutoff = now - (this.config.restartWindowMs ?? RESTART_WINDOW_MS)
    this.restartTimestamps = this.restartTimestamps.filter((t) => t >= cutoff)

    if (this.restartTimestamps.length >= (this.config.restartThreshold ?? RESTART_THRESHOLD)) {
      this.addIncident({
        type: AUTO_STOP_CRITERIA.REPEATED_CRASH,
        severity: IncidentSeverity.Critical,
        message: `Process crashed ${this.restartTimestamps.length} times in ${(this.config.restartWindowMs ?? RESTART_WINDOW_MS) / 1000}s`,
        context: { crashes: this.restartTimestamps.length, window: this.restartTimestamps },
      })
    }
  }

  /** Record a WS reconnect event */
  recordReconnect(): void {
    this.reconnectCount++
    this.lastReconnectTime = Date.now()

    if (this.reconnectCount >= (this.config.maxReconnects ?? MAX_RECONNECT_ATTEMPTS)) {
      this.addIncident({
        type: AUTO_STOP_CRITERIA.MAX_RECONNECT_FAILED,
        severity: IncidentSeverity.Critical,
        message: `Reconnect threshold exceeded: ${this.reconnectCount} reconnects`,
        context: { reconnectCount: this.reconnectCount, threshold: this.config.maxReconnects ?? MAX_RECONNECT_ATTEMPTS },
      })
    }
  }

  /** Record a position desync */
  recordDesync(symbol: string, expected: number, actual: number): void {
    this.desyncCount++
    this.addIncident({
      type: AUTO_STOP_CRITERIA.POSITION_DESYNC,
      severity: IncidentSeverity.Critical,
      message: `Position desync on ${symbol}: expected=${expected} actual=${actual}`,
      context: { symbol, expected, actual },
    })
  }

  /** Record a lost position */
  recordLostPosition(symbol: string): void {
    this.lostPositionCount++
    this.addIncident({
      type: AUTO_STOP_CRITERIA.POSITION_DESYNC,
      severity: IncidentSeverity.Critical,
      message: `Lost position on ${symbol}`,
      context: { symbol },
    })
  }

  /** Record an unhandled exception */
  recordException(error: Error, context?: string): void {
    this.exceptionCount++
    this.addIncident({
      type: AUTO_STOP_CRITERIA.PIPELINE_EXCEPTION,
      severity: IncidentSeverity.Critical,
      message: `Unhandled exception${context ? ` in ${context}` : ''}: ${error.message}`,
      context: { error: error.stack ?? error.message, context },
    })
  }

  /** Record pipeline exception (inside trading pipeline) */
  recordPipelineException(error: Error): void {
    this.pipelineExceptionCount++
    this.recordException(error, 'trading-pipeline')
  }

  /** Record negative balance */
  recordNegativeBalance(asset: string, balance: number): void {
    this.addIncident({
      type: AUTO_STOP_CRITERIA.NEGATIVE_BALANCE,
      severity: IncidentSeverity.Critical,
      message: `Negative balance on ${asset}: ${balance}`,
      context: { asset, balance },
    })
  }

  /** Record market data stall */
  recordMarketDataStall(symbol: string, ageMs: number): void {
    this.addIncident({
      type: AUTO_STOP_CRITERIA.MARKET_DATA_STALL,
      severity: IncidentSeverity.Critical,
      message: `No market data for ${symbol} for ${Math.round(ageMs / 1000)}s`,
      context: { symbol, ageMs },
    })
  }

  /** Record gateway connection state */
  recordGatewayState(connected: boolean): void {
    this.gatewayConnected = connected
  }

  /** Record market data timestamp */
  recordMarketData(time: number): void {
    this.lastMarketDataTime = time
  }

  /** Record latency sample (Feed → Fill) */
  recordLatency(ms: number): void {
    this.lastLatency = ms
    this.latencySamples.push(ms)
    // Keep only last 300 samples (5min at 1/s)
    if (this.latencySamples.length > 300) {
      this.latencySamples = this.latencySamples.slice(-300)
    }
  }

  /** Record memory sample */
  recordMemory(mb: number): void {
    this.memorySamples.push({ time: Date.now(), mb })
    // Keep only samples from last hour
    const cutoff = Date.now() - 60 * 60 * 1000
    this.memorySamples = this.memorySamples.filter((s) => s.time >= cutoff)
  }

  // ── Queries ──

  /** Get snapshot of current health */
  getHealth(): HealthState {
    const now = Date.now()
    const uptime = Math.floor((now - this.startTime) / 1000)

    const avgLatency =
      this.latencySamples.length > 0
        ? Math.round(this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length)
        : 0

    const maxLatencyMs = this.latencySamples.length > 0 ? Math.max(...this.latencySamples) : 0

    // Estimate CPU via process usage
    const cpuPercent = 0 // Would need process.cpuUsage() on long-lived process

    // Memory
    const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)

    // Market data age
    const marketDataAge = this.lastMarketDataTime > 0 ? Math.round((now - this.lastMarketDataTime) / 1000) : -1

    // Log size (approximate via console.log output size tracking — skip for now)
    const logMB = 0

    // Event queue (estimated via pending microtasks — skip, always 0 in Node)

    return {
      status: this.status,
      uptime,
      reconnectCount: this.reconnectCount,
      memoryMB,
      cpuPercent,
      lastLatencyMs: this.lastLatency,
      avgLatencyMs60s: avgLatency,
      maxLatencyMs,
      exceptionCount: this.exceptionCount,
      lostPositionCount: this.lostPositionCount,
      desyncCount: this.desyncCount,
      eventQueueSize: 0,
      logMB,
      gatewayConnected: this.gatewayConnected,
      marketDataAge,
      timestamp: now,
    }
  }

  /** Check if auto-stop should trigger */
  shouldAutoStop(): { stop: boolean; reason?: string } {
    // 1. Position desync detected
    if (this.desyncCount > 0 || this.lostPositionCount > 0) {
      return {
        stop: true,
        reason: `Position desync/lost: ${this.desyncCount} desyncs, ${this.lostPositionCount} lost`,
      }
    }

    // 2. Negative balance
    const hasNegativeBalance = this.incidents.some(
      (i) => i.type === AUTO_STOP_CRITERIA.NEGATIVE_BALANCE
    )
    if (hasNegativeBalance) {
      return { stop: true, reason: 'Negative balance detected' }
    }

    // 3. Pipeline exceptions
    if (this.pipelineExceptionCount > 0) {
      return {
        stop: true,
        reason: `${this.pipelineExceptionCount} pipeline exception(s)`,
      }
    }

    // 4. Repeated crashes
    if (this.crashCount >= (this.config.restartThreshold ?? RESTART_THRESHOLD)) {
      return {
        stop: true,
        reason: `${this.crashCount} process crashes (threshold: ${this.config.restartThreshold ?? RESTART_THRESHOLD})`,
      }
    }

    // 5. Market data stall
    if (this.lastMarketDataTime > 0) {
      const age = Date.now() - this.lastMarketDataTime
      const stallMs = this.config.marketDataStallMs ?? MARKET_DATA_STALL_MS
      if (age > stallMs) {
        return {
          stop: true,
          reason: `Market data stalled for ${Math.round(age / 1000)}s (threshold: ${Math.round(stallMs / 1000)}s)`,
        }
      }
    }

    // 6. Reconnect threshold
    if (this.reconnectCount >= (this.config.maxReconnects ?? MAX_RECONNECT_ATTEMPTS)) {
      return {
        stop: true,
        reason: `${this.reconnectCount} reconnects (threshold: ${this.config.maxReconnects ?? MAX_RECONNECT_ATTEMPTS})`,
      }
    }

    return { stop: false }
  }

  /** Evaluate burn-in criteria */
  evaluateBurnIn(durationMs: number): BurnInResult {
    const health = this.getHealth()

    // Evaluate each criterion
    const criteria: Record<string, boolean> = {
      no_crashes: this.crashCount === 0,
      no_lost_positions: this.lostPositionCount === 0,
      no_desync: this.desyncCount === 0,
      stable_memory: !this.hasMemoryGrowth(),
      no_pipeline_exceptions: this.pipelineExceptionCount === 0,
      gateway_connected: this.gatewayConnected,
      market_data_fresh: this.lastMarketDataTime > 0 && (Date.now() - this.lastMarketDataTime) < MARKET_DATA_STALL_MS,
    }

    const passed = Object.values(criteria).every(Boolean)
    const failedCriteria = Object.entries(criteria)
      .filter(([, v]) => !v)
      .map(([k]) => BURN_IN_CRITERIA_LABELS[k] ?? k)

    return {
      passed,
      durationMs,
      finalHealth: health,
      incidents: [...this.incidents],
      criteria,
      rejectionReason: passed ? undefined : `Burn-in failed: ${failedCriteria.join('; ')}`,
    }
  }

  /** Get all incidents */
  getIncidents(): CampaignIncident[] {
    return [...this.incidents]
  }

  /** Get last market data timestamp (for observability) */
  getMarketDataAge(): number {
    if (this.lastMarketDataTime <= 0) return -1
    return Date.now() - this.lastMarketDataTime
  }

  /** Create an incident */
  private addIncident(partial: Omit<CampaignIncident, 'id' | 'timestamp'>): void {
    const incident: CampaignIncident = {
      id: `inc-${++this.incidentCounter}`,
      timestamp: Date.now(),
      ...partial,
    }
    this.incidents.push(incident)

    // Update status based on severity
    if (partial.severity === IncidentSeverity.Critical) {
      this.status = 'critical'
    } else if (partial.severity === IncidentSeverity.Warning && this.status === 'healthy') {
      this.status = 'degraded'
    }
  }

  /** Check if memory shows monontonic growth (simple heuristic) */
  private hasMemoryGrowth(): boolean {
    if (this.memorySamples.length < 10) return false

    const first = this.memorySamples[0]
    const last = this.memorySamples[this.memorySamples.length - 1]
    const timeSpan = last.time - first.time
    if (timeSpan < 30 * 60 * 1000) return false // need at least 30min

    const growthPct = ((last.mb - first.mb) / first.mb) * 100
    return growthPct > MEMORY_GROWTH_THRESHOLD_PCT
  }

  /** Reset state (for a new session) */
  reset(): void {
    this.restartTimestamps = []
    this.restartCount = 0
    this.reconnectCount = 0
    this.lastReconnectTime = 0
    this.memorySamples = []
    this.exceptionCount = 0
    this.desyncCount = 0
    this.lostPositionCount = 0
    this.lastMarketDataTime = 0
    this.gatewayConnected = false
    this.pipelineExceptionCount = 0
    this.incidents = []
    this.status = 'healthy'
    this.startTime = Date.now()
    this.crashCount = 0
    this.latencySamples = []
    this.lastLatency = 0
    this.incidentCounter = 0
  }
}
