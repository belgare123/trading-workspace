// ── MetricDefinition — Base abstraction for all metrics ──
//
// Every metric is a standalone definition following the platform pattern.
// New metrics can be added without changing MetricsRuntime.
//
// @since 3.5.2

import type { MetricDefinition as IMetricDefinition } from '../types'

export type { IMetricDefinition as MetricDefinition }
export type { MetricContext, MetricValue } from '../types'
