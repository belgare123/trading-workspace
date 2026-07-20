/**
 * types.ts — Campaign type definitions
 *
 * Defines the state machine, incidents, health metrics, and report
 * structures for the two-stage Paper Campaign lifecycle.
 *
 * @since 4.9
 */

// ── Campaign Stages ──

export enum CampaignStage {
  /** Not started */
  Idle = 'idle',
  /** Stage 1 — 24-hour infrastructure burn-in */
  BurnIn = 'burn-in',
  /** Burn-in passed, ready to roll into campaign */
  BurnInComplete = 'burn-in-complete',
  /** Stage 2 — 7-day paper trading campaign */
  PaperCampaign = 'paper-campaign',
  /** Campaign finished successfully */
  Completed = 'completed',
  /** Campaign terminated by auto-stop */
  Failed = 'failed',
}

export enum CampaignMode {
  BurnIn = 'burn-in',
  FullCampaign = 'full-campaign',
}

// ── Incidents ──

export enum IncidentSeverity {
  /** Info — no action needed */
  Info = 'info',
  /** Warning — may indicate degradation */
  Warning = 'warning',
  /** Critical — triggers auto-stop */
  Critical = 'critical',
}

export interface CampaignIncident {
  id: string
  type: string
  severity: IncidentSeverity
  message: string
  timestamp: number
  context?: Record<string, unknown>
}

// ── Health State ──

export interface HealthState {
  /** Overall status */
  status: 'healthy' | 'degraded' | 'critical' | 'stopped'
  /** Process uptime in seconds */
  uptime: number
  /** Sum of all WS reconnect events */
  reconnectCount: number
  /** Memory usage in MB */
  memoryMB: number
  /** CPU usage % */
  cpuPercent: number
  /** Feed → Fill latency — last measurement (ms) */
  lastLatencyMs: number
  /** Feed → Fill — 60s average (ms) */
  avgLatencyMs60s: number
  /** Feed → Fill — max in window (ms) */
  maxLatencyMs: number
  /** Unhandled exception count */
  exceptionCount: number
  /** Lost-position incidents */
  lostPositionCount: number
  /** Desync incidents */
  desyncCount: number
  /** Event queue size */
  eventQueueSize: number
  /** Log file size in MB */
  logMB: number
  /** Gateway connected */
  gatewayConnected: boolean
  /** Market data freshness (seconds since last tick) */
  marketDataAge: number
  /** Timestamp of last health check */
  timestamp: number
}

// ── Burn-in Results ──

export interface BurnInResult {
  /** Did burn-in pass all criteria */
  passed: boolean
  /** Duration in ms */
  durationMs: number
  /** Snapshot of health at end */
  finalHealth: HealthState
  /** All incidents during burn-in */
  incidents: CampaignIncident[]
  /** Pass/fail for each criterion */
  criteria: Record<string, boolean>
  /** Rejection reason if failed */
  rejectionReason?: string
}

// ── Campaign Report ──

export interface CampaignDailyReport {
  /** Day number (1-7) */
  day: number
  /** Date string */
  date: string
  /** Duration in ms */
  durationMs: number
  /** Start of period */
  periodStart: number
  /** End of period */
  periodEnd: number
  /** Incidents in this period */
  incidents: CampaignIncident[]
  /** Health at report time */
  currentHealth: HealthState
  /** Total orders placed */
  totalOrders: number
  /** Total fills */
  totalFills: number
  /** Total PnL */
  totalPnl: number
  /** Peak memory (MB) */
  peakMemoryMB: number
}

export interface CampaignFinalReport {
  /** Overall success */
  success: boolean
  /** Burn-in result */
  burnIn: BurnInResult
  /** Campaign daily reports */
  dailyReports: CampaignDailyReport[]
  /** Override if campaign was not completed */
  stage: CampaignStage
  /** All incidents across entire campaign */
  totalIncidents: number
  /** Critical incidents */
  criticalIncidents: number
  /** Peak memory across run (MB) */
  peakMemoryMB: number
  /** Total orders */
  totalOrders: number
  /** Total PnL */
  totalPnl: number
}

// ── Auto-Stop Criteria ──

export const AUTO_STOP_CRITERIA = {
  /** Position sync lost (paper vs computed) */
  POSITION_DESYNC: 'position_desync',
  /** Negative balance when impossible by logic */
  NEGATIVE_BALANCE: 'negative_balance',
  /** Unhandled exception in trading pipeline */
  PIPELINE_EXCEPTION: 'pipeline_exception',
  /** Repeated process crashes (>N restarts in window) */
  REPEATED_CRASH: 'repeated_crash',
  /** No market data for >60s */
  MARKET_DATA_STALL: 'market_data_stall',
  /** Cannot reconnect after N attempts */
  MAX_RECONNECT_FAILED: 'reconnect_failed',
} as const

// ── Burn-in Pass Criteria ──

export const BURN_IN_CRITERIA_LABELS: Record<string, string> = {
  no_crashes: '0 аварийных остановок',
  no_lost_positions: '0 потерянных позиций',
  no_desync: '0 рассинхронизаций',
  stable_memory: 'Стабильное потребление памяти (без монотонного роста)',
  no_pipeline_exceptions: '0 необработанных исключений в pipeline',
  gateway_connected: 'GatewayRuntime стабильно подключён',
  market_data_fresh: 'Рыночные данные поступают (не старше 60с)',
}

/** Default burn-in duration (24 hours) */
export const BURN_IN_DURATION_MS = 24 * 60 * 60 * 1000

/** Default campaign duration (7 days) */
export const CAMPAIGN_DURATION_MS = 7 * 24 * 60 * 60 * 1000

/** Max reconnect attempts before auto-stop */
export const MAX_RECONNECT_ATTEMPTS = 10

/** Restart threshold: N restarts in M seconds triggers auto-stop */
export const RESTART_THRESHOLD = 3
export const RESTART_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/** Market data stall threshold (seconds) */
export const MARKET_DATA_STALL_MS = 60 * 1000

/** Memory growth threshold: >X% increase over 1 hour = leak suspicion */
export const MEMORY_GROWTH_THRESHOLD_PCT = 15

/** Report interval */
export const HEALTH_CHECK_INTERVAL_MS = 60 * 1000 // every minute
export const CERTIFICATION_INTERVAL_MS = 6 * 60 * 60 * 1000 // every 6 hours
export const DAILY_REPORT_INTERVAL_MS = 24 * 60 * 60 * 1000
