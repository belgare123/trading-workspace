/**
 * PrometheusExporter.ts — Prometheus /metrics endpoint generator
 *
 * Converts RuntimeTelemetry snapshots into Prometheus text format
 * (https://prometheus.io/docs/instrumenting/exposition_formats/).
 *
 * Supports:
 *   - Counter, Gauge, Histogram metric types
 *   - HELP + TYPE comments
 *   - Exemplars (OpenMetrics format)
 *   - Resource labels on every metric
 *   - Health-check endpoint
 *
 * @since 6.4.0
 */

import { TelemetryExporter, type ExporterHealth } from './TelemetryExporter'
import type { SliSystemSnapshot, SliRuntimeSnapshot, SliMetric } from '../../../workspace/live/sli/SliTypes'
import { MetricMapper, type MetricMapping } from './MetricMapper'
import { getResourceAttributes, mergeLabels } from './ResourceAttributes'
import { exemplarStore } from './ExemplarStore'

/* ── Config ── */

export interface PrometheusExporterConfig {
  /** Include exemplars in output (default: true) */
  includeExemplars: boolean
  /** Include HELP/TYPE comments (default: true) */
  includeHelp: boolean
  /** Enable /health endpoint (default: true) */
  enableHealth: boolean
}

const DEFAULT_CONFIG: PrometheusExporterConfig = {
  includeExemplars: true,
  includeHelp: true,
  enableHealth: true,
}

/* ── State ── */

/* ── Exporter ── */

export class PrometheusExporter extends TelemetryExporter {
  readonly name = 'prometheus'
  private config: PrometheusExporterConfig
  private _lastSnapshot: SliSystemSnapshot | null = null
  private _cachedOutput: string = ''
  private _lastExportTime = 0
  private _lastMetricCount = 0
  private _droppedCount = 0
  private _exportTotal = 0

  constructor(config?: Partial<PrometheusExporterConfig>) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  exportAll(snapshot: SliSystemSnapshot): void {
    this._lastSnapshot = snapshot
    this._cachedOutput = this._render(snapshot)
    this._lastExportTime = Date.now()
    this._lastMetricCount = this._countMetrics(snapshot)
    this._exportTotal++
  }

  /** Render the /metrics output (from last snapshot) */
  render(): string {
    if (!this._lastSnapshot) return '# no metrics yet\\n'
    return this._cachedOutput || this._render(this._lastSnapshot)
  }

  /** Force re-render from a snapshot */
  renderFrom(snapshot: SliSystemSnapshot): string {
    return this._render(snapshot)
  }

  health(): ExporterHealth {
    return {
      name: 'prometheus',
      healthy: this._lastExportTime > 0,
      lastExport: this._lastExportTime,
      lastMetricCount: this._lastMetricCount,
      queueDepth: 0,
      droppedMetrics: this._droppedCount,
      message: this._lastExportTime > 0 ? `Exported ${this._exportTotal} times` : 'No export yet',
    }
  }

  /* ── Render ── */

  private _render(snapshot: SliSystemSnapshot): string {
    const lines: string[] = []

    for (const runtime of snapshot.runtimes) {
      const entries = MetricMapper.translateSnapshot(runtime)
      for (const { mapping, metric } of entries) {
        this._renderMetric(lines, mapping, metric, runtime)
      }
    }

    // Export health metric
    lines.push('# HELP telemetry_exporter_health Telemetry exporter health (1=up, 0=down)')
    lines.push('# TYPE telemetry_exporter_health gauge')
    lines.push(`telemetry_exporter_health{exporter="prometheus"} 1`)

    return lines.join('\n') + '\n'
  }

  private _renderMetric(lines: string[], mapping: MetricMapping, metric: SliMetric, runtime: SliRuntimeSnapshot): void {
    const labels = mergeLabels(mapping.resourceLabels.reduce((acc, k) => {
      const a = getResourceAttributes()
      const val = (a as Record<string, string>)[k]
      if (val && val !== 'all') acc[k] = val
      return acc
    }, {} as Record<string, string>))

    const labelsStr = this._formatLabels(labels)
    // Strip outer braces for concatenation with extra labels
    const labelsInner = labelsStr ? labelsStr.replace(/^{/, '').replace(/}$/, '') : ''
    const help = mapping.help
    const name = mapping.prometheusName

    if (this.config.includeHelp) {
      lines.push(`# HELP ${name} ${help}`)
      lines.push(`# TYPE ${name} ${mapping.prometheusKind}`)
    }

    switch (mapping.prometheusKind) {
      case 'counter':
        lines.push(`${name}${labelsStr} ${metric.value}`)
        this._appendExemplar(lines, name, metric.value)
        break

      case 'gauge':
        lines.push(`${name}${labelsStr} ${metric.value}`)
        this._appendExemplar(lines, name, metric.value)
        break

      case 'histogram': {
        const percentiles = metric.percentiles
        if (percentiles) {
          const buckets = mapping.buckets ?? [1, 5, 10, 25, 50, 100, 250, 500, 1000]
          // Generate cumulative histogram buckets from percentiles approximation
          for (const le of buckets) {
            // Estimate count: if pX <= le, this bucket contains at least X% of samples
            let bucketCount = 0
            const totalSamples = percentiles.count
            if (totalSamples > 0) {
              if (le >= percentiles.p99) bucketCount = totalSamples
              else if (le >= percentiles.p95) bucketCount = Math.floor(totalSamples * 0.99)
              else if (le >= percentiles.p90) bucketCount = Math.floor(totalSamples * 0.95)
              else if (le >= percentiles.p75) bucketCount = Math.floor(totalSamples * 0.90)
              else if (le >= percentiles.p50) bucketCount = Math.floor(totalSamples * 0.75)
              // Below p50: rough estimate
              else if (le >= percentiles.min) bucketCount = Math.floor(totalSamples * 0.25)
            }
            lines.push(`${name}_bucket{${labelsInner ? labelsInner + ',' : ''}le="${le}"} ${bucketCount}`)
          }

          // +Inf bucket
          lines.push(`${name}_bucket{${labelsInner ? labelsInner + ',' : ''}le="+Inf"} ${percentiles.count}`)
          lines.push(`${name}_sum{${labelsInner}} ${Math.round(percentiles.mean * percentiles.count)}`)
          lines.push(`${name}_count{${labelsInner}} ${percentiles.count}`)
        } else {
          // No percentile data — fall back to single value as count
          lines.push(`${name}_count${labelsStr} ${metric.value > 0 ? 1 : 0}`)
          lines.push(`${name}_sum${labelsStr} ${metric.value}`)
        }
        break
      }
    }
  }

  private _formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels).filter(([_, v]) => v !== '' && v !== 'all')
    if (entries.length === 0) return ''
    return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}'
  }

  private _appendExemplar(lines: string[], metricName: string, value: number): void {
    if (!this.config.includeExemplars) return
    const exemplars = exemplarStore.getForMetric(metricName)
    if (exemplars.length === 0) return
    // Only attach the most recent exemplar
    const ex = exemplars[exemplars.length - 1]!
    lines[lines.length - 1] += ` # {traceId="${ex.traceId}"} ${ex.value} ${ex.timestamp}`
  }

  private _countMetrics(snapshot: SliSystemSnapshot): number {
    let count = 0
    for (const runtime of snapshot.runtimes) {
      count += runtime.metrics.length
    }
    return count
  }
}
