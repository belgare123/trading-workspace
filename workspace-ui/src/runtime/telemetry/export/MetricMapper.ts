/**
 * MetricMapper.ts — Single source of truth for SLI → metric name mapping
 *
 * Translates every SliDescriptor from RuntimeTelemetry into:
 *   - Prometheus metric name + type
 *   - OpenTelemetry metric name + instrument kind
 *   - Help string, labels, and default buckets
 *
 * Every exporter uses MetricMapper — never duplicate name logic.
 *
 * @since 6.4.0
 */

import type { SliDescriptor, SliPercentiles, SliRuntimeSnapshot, SliMetric } from '../../../workspace/live/sli/SliTypes'

/* ── Exported metric types ── */

export type PrometheusMetricKind = 'counter' | 'gauge' | 'histogram'
export type OTelInstrumentKind = 'counter' | 'gauge' | 'histogram'

export interface MetricMapping {
  /** SLI descriptor (source) */
  descriptor: SliDescriptor
  /** Prometheus metric name (e.g. 'gateway_request_latency_ms') */
  prometheusName: string
  /** Prometheus type */
  prometheusKind: PrometheusMetricKind
  /** OTel metric name (e.g. 'gateway.request.latency') */
  otelName: string
  /** OTel instrument kind */
  otelKind: OTelInstrumentKind
  /** Prometheus HELP string */
  help: string
  /** Default histogram buckets (only for latency) */
  buckets?: number[]
  /** Resource labels to attach */
  resourceLabels: string[]
}

/* ── Mapped domains ── */

type DomainMap = Record<string, Record<string, MetricMapping>>

const BUCKETS_MS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
const BUCKETS_COUNT = [1, 2, 5, 10, 25, 50, 100]

/**
 * Central mapping registry — one entry per SLI metric.
 * This is the only place where names and types are defined.
 */
const DOMAIN_METRICS: DomainMap = {
  gateway: {
    request_latency: {
      descriptor: { name: 'gateway.request_latency', label: 'Gateway Request Latency', kind: 'latency', unit: 'ms', domain: 'gateway' },
      prometheusName: 'gateway_request_latency_ms',
      prometheusKind: 'histogram',
      otelName: 'gateway.request.latency',
      otelKind: 'histogram',
      help: 'Exchange gateway request latency in milliseconds',
      buckets: BUCKETS_MS,
      resourceLabels: ['exchange', 'symbol'],
    },
    exchange_latency: {
      descriptor: { name: 'gateway.exchange_latency', label: 'Exchange Latency', kind: 'latency', unit: 'ms', domain: 'gateway' },
      prometheusName: 'gateway_exchange_latency_ms',
      prometheusKind: 'histogram',
      otelName: 'gateway.exchange.latency',
      otelKind: 'histogram',
      help: 'Exchange round-trip latency in milliseconds',
      buckets: BUCKETS_MS,
      resourceLabels: ['exchange'],
    },
    queue_depth: {
      descriptor: { name: 'gateway.queue_depth', label: 'Gateway Queue Depth', kind: 'gauge', unit: 'count', domain: 'gateway' },
      prometheusName: 'gateway_queue_depth',
      prometheusKind: 'gauge',
      otelName: 'gateway.queue.depth',
      otelKind: 'gauge',
      help: 'Number of pending requests in gateway queue',
      resourceLabels: ['exchange'],
    },
    reconnect_count: {
      descriptor: { name: 'gateway.reconnect_count', label: 'Gateway Reconnect Count', kind: 'rate', unit: 'count', domain: 'gateway' },
      prometheusName: 'gateway_reconnect_total',
      prometheusKind: 'counter',
      otelName: 'gateway.reconnect.count',
      otelKind: 'counter',
      help: 'Total number of gateway reconnections',
      resourceLabels: ['exchange'],
    },
    open_requests: {
      descriptor: { name: 'gateway.open_requests', label: 'Gateway Open Requests', kind: 'gauge', unit: 'count', domain: 'gateway' },
      prometheusName: 'gateway_open_requests',
      prometheusKind: 'gauge',
      otelName: 'gateway.open.requests',
      otelKind: 'gauge',
      help: 'Currently active/open gateway requests',
      resourceLabels: ['exchange'],
    },
    error_rate: {
      descriptor: { name: 'gateway.error_rate', label: 'Gateway Error Rate', kind: 'rate', unit: 'count', domain: 'gateway' },
      prometheusName: 'gateway_errors_total',
      prometheusKind: 'counter',
      otelName: 'gateway.errors',
      otelKind: 'counter',
      help: 'Total number of gateway errors',
      resourceLabels: ['exchange'],
    },
  },
  trade: {
    entry_latency: {
      descriptor: { name: 'trade.entry_latency', label: 'Trade Entry Latency', kind: 'latency', unit: 'ms', domain: 'trade' },
      prometheusName: 'trade_entry_latency_ms',
      prometheusKind: 'histogram',
      otelName: 'trade.entry.latency',
      otelKind: 'histogram',
      help: 'Trade entry latency from signal to fill in milliseconds',
      buckets: BUCKETS_MS,
      resourceLabels: ['symbol'],
    },
    exit_latency: {
      descriptor: { name: 'trade.exit_latency', label: 'Trade Exit Latency', kind: 'latency', unit: 'ms', domain: 'trade' },
      prometheusName: 'trade_exit_latency_ms',
      prometheusKind: 'histogram',
      otelName: 'trade.exit.latency',
      otelKind: 'histogram',
      help: 'Trade exit latency from decision to fill in milliseconds',
      buckets: BUCKETS_MS,
      resourceLabels: ['symbol'],
    },
    active_trades: {
      descriptor: { name: 'trade.active_trades', label: 'Active Trades', kind: 'gauge', unit: 'count', domain: 'trade' },
      prometheusName: 'trade_active_trades',
      prometheusKind: 'gauge',
      otelName: 'trade.active.trades',
      otelKind: 'gauge',
      help: 'Number of currently active trades',
      resourceLabels: [],
    },
    recovery_duration: {
      descriptor: { name: 'trade.recovery_duration', label: 'Recovery Duration', kind: 'latency', unit: 'ms', domain: 'trade' },
      prometheusName: 'trade_recovery_duration_ms',
      prometheusKind: 'histogram',
      otelName: 'trade.recovery.duration',
      otelKind: 'histogram',
      help: 'Trade recovery duration in milliseconds after restart',
      buckets: BUCKETS_MS,
      resourceLabels: [],
    },
    trade_throughput: {
      descriptor: { name: 'trade.trade_throughput', label: 'Trade Throughput', kind: 'rate', unit: 'count', domain: 'trade' },
      prometheusName: 'trade_throughput_total',
      prometheusKind: 'counter',
      otelName: 'trade.throughput',
      otelKind: 'counter',
      help: 'Total number of completed trades',
      resourceLabels: ['symbol'],
    },
  },
  wallet: {
    free_balance: {
      descriptor: { name: 'wallet.free_balance', label: 'Free Balance', kind: 'gauge', unit: 'quote', domain: 'wallet' },
      prometheusName: 'wallet_free_balance',
      prometheusKind: 'gauge',
      otelName: 'wallet.balance.free',
      otelKind: 'gauge',
      help: 'Free (unallocated) balance in quote currency',
      resourceLabels: ['exchange', 'symbol'],
    },
    reserved_balance: {
      descriptor: { name: 'wallet.reserved_balance', label: 'Reserved Balance', kind: 'gauge', unit: 'quote', domain: 'wallet' },
      prometheusName: 'wallet_reserved_balance',
      prometheusKind: 'gauge',
      otelName: 'wallet.balance.reserved',
      otelKind: 'gauge',
      help: 'Reserved (allocated to open orders) balance',
      resourceLabels: ['exchange', 'symbol'],
    },
  },
  risk: {
    validation_latency: {
      descriptor: { name: 'risk.validation_latency', label: 'Risk Validation Latency', kind: 'latency', unit: 'ms', domain: 'risk' },
      prometheusName: 'risk_validation_latency_ms',
      prometheusKind: 'histogram',
      otelName: 'risk.validation.latency',
      otelKind: 'histogram',
      help: 'Risk rule validation latency in milliseconds',
      buckets: BUCKETS_MS,
      resourceLabels: [],
    },
    reject_rate: {
      descriptor: { name: 'risk.reject_rate', label: 'Risk Reject Rate', kind: 'rate', unit: 'count', domain: 'risk' },
      prometheusName: 'risk_rejects_total',
      prometheusKind: 'counter',
      otelName: 'risk.rejects',
      otelKind: 'counter',
      help: 'Total number of orders rejected by risk rules',
      resourceLabels: ['exchange'],
    },
    slow_rules: {
      descriptor: { name: 'risk.slow_rules', label: 'Slow Risk Rules', kind: 'count', unit: 'count', domain: 'risk' },
      prometheusName: 'risk_slow_rules_total',
      prometheusKind: 'counter',
      otelName: 'risk.slow.rules',
      otelKind: 'counter',
      help: 'Total number of slow (>50ms) risk rule evaluations',
      resourceLabels: [],
    },
    evaluations_total: {
      descriptor: { name: 'risk.evaluations_total', label: 'Risk Evaluations Total', kind: 'count', unit: 'count', domain: 'risk' },
      prometheusName: 'risk_evaluations_total',
      prometheusKind: 'counter',
      otelName: 'risk.evaluations',
      otelKind: 'counter',
      help: 'Total number of risk evaluations',
      resourceLabels: ['exchange'],
    },
  },
  strategy: {
    signal_latency: {
      descriptor: { name: 'strategy.signal_latency', label: 'Signal Latency', kind: 'latency', unit: 'ms', domain: 'strategy' },
      prometheusName: 'strategy_signal_latency_ms',
      prometheusKind: 'histogram',
      otelName: 'strategy.signal.latency',
      otelKind: 'histogram',
      help: 'Strategy signal generation latency in milliseconds',
      buckets: BUCKETS_MS,
      resourceLabels: ['symbol'],
    },
    signals_per_sec: {
      descriptor: { name: 'strategy.signals_per_sec', label: 'Signals Per Second', kind: 'rate', unit: 'req/s', domain: 'strategy' },
      prometheusName: 'strategy_signals_total',
      prometheusKind: 'counter',
      otelName: 'strategy.signals',
      otelKind: 'counter',
      help: 'Total number of strategy signals generated',
      resourceLabels: ['symbol'],
    },
    active_strategies: {
      descriptor: { name: 'strategy.active_strategies', label: 'Active Strategies', kind: 'gauge', unit: 'count', domain: 'strategy' },
      prometheusName: 'strategy_active_strategies',
      prometheusKind: 'gauge',
      otelName: 'strategy.active.strategies',
      otelKind: 'gauge',
      help: 'Number of currently running strategy instances',
      resourceLabels: [],
    },
    signals_total: {
      descriptor: { name: 'strategy.signals_total', label: 'Signals Total', kind: 'count', unit: 'count', domain: 'strategy' },
      prometheusName: 'strategy_signals_generated_total',
      prometheusKind: 'counter',
      otelName: 'strategy.signals.total',
      otelKind: 'counter',
      help: 'Total number of signals generated across all strategies',
      resourceLabels: [],
    },
  },
}

/* ── MetricMapper API ── */

export const MetricMapper = {
  /** Get all metric mappings across all domains */
  getAllMappings(): MetricMapping[] {
    const result: MetricMapping[] = []
    for (const domain of Object.values(DOMAIN_METRICS)) {
      for (const mapping of Object.values(domain)) {
        result.push(mapping)
      }
    }
    return result
  },

  /** Get mappings for a specific domain */
  getDomainMappings(domain: string): MetricMapping[] {
    const domainMetrics = DOMAIN_METRICS[domain]
    if (!domainMetrics) return []
    return Object.values(domainMetrics)
  },

  /** Find mapping by SLI name (e.g. 'gateway.request_latency') */
  findMapping(name: string): MetricMapping | undefined {
    for (const domain of Object.values(DOMAIN_METRICS)) {
      for (const [sliName, mapping] of Object.entries(domain)) {
        if (sliName === name || mapping.descriptor.name === name) {
          return mapping
        }
      }
    }
    return undefined
  },

  /** Get mapping by Prometheus metric name */
  fromPrometheusName(prometheusName: string): MetricMapping | undefined {
    for (const domain of Object.values(DOMAIN_METRICS)) {
      for (const mapping of Object.values(domain)) {
        if (mapping.prometheusName === prometheusName) return mapping
      }
    }
    return undefined
  },

  /** Get mapping by OTel metric name */
  fromOtelName(otelName: string): MetricMapping | undefined {
    for (const domain of Object.values(DOMAIN_METRICS)) {
      for (const mapping of Object.values(domain)) {
        if (mapping.otelName === otelName) return mapping
      }
    }
    return undefined
  },

  /** Check if a mapping exists for a given SLI name */
  hasMapping(name: string): boolean {
    return MetricMapper.findMapping(name) !== undefined
  },

  /** Translate a full SLI snapshot into mapped metric entries */
  translateSnapshot(snapshot: SliRuntimeSnapshot): MappedMetricEntry[] {
    const entries: MappedMetricEntry[] = []
    const domainMappings = MetricMapper.getDomainMappings(snapshot.domain)
    const mappingMap = new Map(domainMappings.map(m => [m.descriptor.name, m]))

    for (const metric of snapshot.metrics) {
      const mapping = mappingMap.get(metric.name)
      if (!mapping) continue

      entries.push({
        mapping,
        metric,
        domain: snapshot.domain,
        timestamp: snapshot.timestamp,
      })
    }
    return entries
  },
}

export interface MappedMetricEntry {
  mapping: MetricMapping
  metric: SliMetric
  domain: string
  timestamp: number
}

/** Determine Prometheus metric type from SLI kind */
export function sliKindToPrometheus(kind: string): PrometheusMetricKind {
  switch (kind) {
    case 'latency': return 'histogram'
    case 'count': return 'counter'
    case 'rate': return 'counter'
    case 'gauge': return 'gauge'
    default: return 'gauge'
  }
}
