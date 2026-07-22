/**
 * sli/index.ts — RuntimeTelemetry barrel export
 *
 * @since 6.3.0
 */

export { SliCollector } from './SliCollector'
export type { SliCollectorConfig } from './SliCollector'

export { RuntimeTelemetry, runtimeTelemetry } from './RuntimeTelemetry'
export type {
  GatewayTelemetry,
  TradeTelemetry,
  WalletTelemetry,
  RiskTelemetry,
  StrategyTelemetry,
} from './RuntimeTelemetry'

export type {
  SliKind,
  SliDescriptor,
  SliMeasurement,
  SliWindow,
  SliPercentiles,
  SliMetricSnapshot,
  SliRuntimeSnapshot,
  TelemetrySnapshot,
} from './SliTypes'
