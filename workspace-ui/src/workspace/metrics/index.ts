// ── Metrics / Analytics Runtime — Barrel Export ──
//
// @since 3.5.2

// ── Types ──
export type {
  MetricDefinition,
  MetricValue,
  MetricContext,
  MetricCategory,
  Collector,
  EventBusHandle,
  Curve,
  CurvePoint,
  DrawdownPoint,
  MetricsReport,
  TimePoint,
  PositionEventData,
} from './types'

export type { TradeRecord, EquitySnapshot, Position, ExecutionEvent } from './types'

// ── Definition + Registry ──
export { MetricRegistry } from './registry/MetricRegistry'

// ── Collectors ──
export { TradeCollector } from './collectors/TradeCollector'
export { PositionCollector } from './collectors/PositionCollector'
export { EquityCollector } from './collectors/EquityCollector'
export { EventCollector } from './collectors/EventCollector'

// ── Metric Definitions ──
export { WinRateMetric } from './metrics/WinRateMetric'
export { ProfitFactorMetric } from './metrics/ProfitFactorMetric'
export { ExpectancyMetric } from './metrics/ExpectancyMetric'
export { SharpeMetric } from './metrics/SharpeMetric'
export { SortinoMetric } from './metrics/SortinoMetric'
export { MaxDrawdownMetric } from './metrics/MaxDrawdownMetric'
export { RecoveryFactorMetric } from './metrics/RecoveryFactorMetric'
export { CalmarMetric } from './metrics/CalmarMetric'
export { SQNMetric } from './metrics/SQNMetric'
export { KellyMetric } from './metrics/KellyMetric'

// ── Curves ──
export { EquityCurve } from './curves/EquityCurve'
export { BalanceCurve } from './curves/BalanceCurve'
export { DrawdownCurve } from './curves/DrawdownCurve'
export { ExposureCurve } from './curves/ExposureCurve'

// ── Reports ──
export { PerformanceReport } from './reports/PerformanceReport'
export { RiskReport } from './reports/RiskReport'
export { SummaryReport } from './reports/SummaryReport'

// ── Serialization ──
export { MetricsSerializer } from './serialization/MetricsSerializer'
export { createSnapshot } from './serialization/MetricsSnapshot'
export type { MetricsSnapshot } from './serialization/MetricsSnapshot'

// ── Runtime ──
export { MetricsRuntime } from './runtime/MetricsRuntime'
