/**
 * campaign/index.ts — Campaign module barrel exports
 *
 * @since 4.9
 */

export { createCampaignContext } from './CampaignContext'
export type { CampaignContext } from './CampaignContext'

export {
  SNAPSHOT_SCHEMA_VERSION,
} from './CampaignMetricsTypes'
export type {
  RawMetrics,
  TradingSnapshot,
  RuntimeSnapshot,
  HealthSnapshot,
  ComponentHealth,
  InvariantSnapshot,
  InvariantResult,
  CampaignSnapshotData,
} from './CampaignMetricsTypes'

export { CampaignSnapshot } from './CampaignSnapshot'

export { CampaignMetricsProvider } from './CampaignMetricsProvider'
export type { CampaignMetricsProviderConfig, ExecutionMetricsSource } from './CampaignMetricsProvider'

export { CampaignSnapshotWriter } from './CampaignSnapshotWriter'
export type { CampaignSnapshotWriterConfig } from './CampaignSnapshotWriter'

export { CampaignMetricsCollector } from './CampaignMetricsCollector'
export type { CampaignMetricsCollectorConfig, CollectorStats } from './CampaignMetricsCollector'

// ── Re-export existing campaign types for convenience ──

export {
  CampaignStage,
  CampaignMode,
  IncidentSeverity,
  AUTO_STOP_CRITERIA,
  BURN_IN_CRITERIA_LABELS,
  BURN_IN_DURATION_MS,
  CAMPAIGN_DURATION_MS,
  HEALTH_CHECK_INTERVAL_MS,
  CERTIFICATION_INTERVAL_MS,
  DAILY_REPORT_INTERVAL_MS,
} from './types'
export type {
  CampaignIncident,
  HealthState,
  BurnInResult,
  CampaignDailyReport,
  CampaignFinalReport,
} from './types'

export { PaperCampaign } from './PaperCampaign'
export type { PaperCampaignConfig } from './PaperCampaign'

export { CampaignSupervisor } from './CampaignSupervisor'
export type { SupervisorConfig } from './CampaignSupervisor'

export { CampaignReporter } from './CampaignReporter'
