/**
 * campaign/index.ts — Campaign Engine barrel
 *
 * Sprint 6.6.6 — Full Chaos Campaign
 *
 * @since 6.6.6
 */

// Block 1: Campaign Engine
export { CampaignEngine, CampaignTimelineBuilder } from './CampaignEngine'
export type {
  AssertSpec,
  CampaignStepDef,
  CampaignAssertion,
  CampaignAssertionStatus,
  CampaignStepResult,
  SLOResult,
  CampaignContext,
  CampaignDependencies,
  CampaignEvent,
  CampaignReport,
  CampaignConfig,
} from './CampaignEngine'

// Block 2: Multi-Failure Scenarios
export {
  createExchangeSlowScenario,
  createNetworkPartitionScenario,
  createExchangeOutageScenario,
  createCascadingFailureScenario,
  createAllScenarios,
} from './MultiFailureScenarios'
export type { ScenarioOptions } from './MultiFailureScenarios'

// Block 3: Continuous Certification
export {
  checkGatewayHealthy,
  checkWalletConsistent,
  checkNoDuplicateTrades,
  checkReplayHash,
  checkChaosTraceComplete,
  checkMetricsConsistent,
  checkAllInvariants,
} from './ContinuousCertification'

// Block 4: SLO Certification
export {
  checkGatewayRecoverySLO,
  checkReplayCompletionSLO,
  checkWalletSyncSLO,
  checkChaosDetectionSLO,
  checkCircuitBreakerOpenSLO,
  checkAllSLOs,
  DEFAULT_SLOS,
} from './SLOCertification'
export type { SLODef } from './SLOCertification'

// Block 5: Incident Bundle
export { IncidentBundle } from './IncidentBundle'
export type { IncidentBundleManifest, IncidentBundleContent } from './IncidentBundle'

// Block 7: Final Gate
export { FinalGate } from './FinalGate'
export type { GateDecision, FinalGateResult, FinalGateConfig } from './FinalGate'
