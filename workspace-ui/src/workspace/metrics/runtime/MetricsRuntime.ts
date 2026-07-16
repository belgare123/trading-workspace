// ── MetricsRuntime — Facade for the Analytics Runtime ──
//
// Orchestrates the full analytics pipeline:
//   ExecutionEventBus → Collectors → MetricsRegistry → Reports
//
// @since 3.5.2

import type { MetricValue, MetricContext, MetricsReport, Collector } from '../types'

import { MetricRegistry } from '../registry/MetricRegistry'
import { TradeCollector } from '../collectors/TradeCollector'
import { PositionCollector } from '../collectors/PositionCollector'
import { EquityCollector } from '../collectors/EquityCollector'
import { EventCollector } from '../collectors/EventCollector'

import { EquityCurve } from '../curves/EquityCurve'
import { BalanceCurve } from '../curves/BalanceCurve'
import { DrawdownCurve } from '../curves/DrawdownCurve'
import { ExposureCurve } from '../curves/ExposureCurve'

import { PerformanceReport } from '../reports/PerformanceReport'
import { RiskReport } from '../reports/RiskReport'
import { SummaryReport } from '../reports/SummaryReport'

import { createSnapshot } from '../serialization/MetricsSnapshot'
import type { MetricsSnapshot } from '../serialization/MetricsSnapshot'

import type { ExecutionEventBus } from '../../execution/events/ExecutionEvents'

// ── Default metrics ──
import { WinRateMetric } from '../metrics/WinRateMetric'
import { ProfitFactorMetric } from '../metrics/ProfitFactorMetric'
import { ExpectancyMetric } from '../metrics/ExpectancyMetric'
import { SharpeMetric } from '../metrics/SharpeMetric'
import { SortinoMetric } from '../metrics/SortinoMetric'
import { MaxDrawdownMetric } from '../metrics/MaxDrawdownMetric'
import { RecoveryFactorMetric } from '../metrics/RecoveryFactorMetric'
import { CalmarMetric } from '../metrics/CalmarMetric'
import { SQNMetric } from '../metrics/SQNMetric'
import { KellyMetric } from '../metrics/KellyMetric'

export class MetricsRuntime {
  // ── Sub-runtimes ──
  readonly registry: MetricRegistry
  readonly collectors: Collector[]

  // ── Individual collectors (convenience) ──
  readonly tradeCollector: TradeCollector
  readonly positionCollector: PositionCollector
  readonly equityCollector: EquityCollector
  readonly eventCollector: EventCollector

  private connected = false

  constructor() {
    this.tradeCollector = new TradeCollector()
    this.positionCollector = new PositionCollector()
    this.equityCollector = new EquityCollector()
    this.eventCollector = new EventCollector()

    this.collectors = [
      this.tradeCollector,
      this.positionCollector,
      this.equityCollector,
      this.eventCollector,
    ]

    this.registry = new MetricRegistry()

    // Register default metrics
    this.registry.registerAll([
      new WinRateMetric(),
      new ProfitFactorMetric(),
      new ExpectancyMetric(),
      new SharpeMetric(),
      new SortinoMetric(),
      new MaxDrawdownMetric(),
      new RecoveryFactorMetric(),
      new CalmarMetric(),
      new SQNMetric(),
      new KellyMetric(),
    ])
  }

  // ═══════════════════════════════════
  // Connection
  // ═══════════════════════════════════

  /** Connect to an ExecutionEventBus — all collectors start listening */
  connect(bus: ExecutionEventBus): void {
    for (const collector of this.collectors) {
      collector.connect(bus)
    }
    this.connected = true
  }

  get isConnected(): boolean {
    return this.connected
  }

  // ═══════════════════════════════════
  // Computation
  // ═══════════════════════════════════

  /** Build the MetricContext from collector data */
  private buildContext(): MetricContext {
    return {
      trades: this.tradeCollector.trades,
      equity: this.equityCollector.snapshots,
      positions: this.positionCollector.positions,
      balancePoints: this.equityCollector.balancePoints,
      equityPoints: this.equityCollector.equityPoints,
      positionEvents: this.positionCollector.events,
    }
  }

  /** Compute a single metric by id */
  compute(id: string): MetricValue | null {
    const definition = this.registry.get(id)
    if (!definition) return null
    return definition.compute(this.buildContext())
  }

  /** Compute all registered metrics */
  computeAll(): MetricValue[] {
    const ctx = this.buildContext()
    return this.registry.all().map(def => def.compute(ctx))
  }

  /** Compute metrics by category */
  computeByCategory(category: 'trade' | 'risk' | 'performance'): MetricValue[] {
    const ctx = this.buildContext()
    return this.registry.byCategory(category).map(def => def.compute(ctx))
  }

  // ═══════════════════════════════════
  // Curves
  // ═══════════════════════════════════

  /** Build all curves from collector data */
  buildCurves() {
    return {
      equity: new EquityCurve(this.equityCollector.equityPoints),
      balance: new BalanceCurve(this.equityCollector.balancePoints),
      drawdown: new DrawdownCurve(this.equityCollector.equityPoints),
      exposure: new ExposureCurve(this.positionCollector.events),
    }
  }

  // ═══════════════════════════════════
  // Reports
  // ═══════════════════════════════════

  /** Generate a Performance Report */
  performanceReport(): PerformanceReport {
    const tradeMetrics = this.computeByCategory('trade')
    const curves = this.buildCurves()
    return new PerformanceReport(tradeMetrics, [curves.equity, curves.balance])
  }

  /** Generate a Risk Report */
  riskReport(): RiskReport {
    const riskMetrics = this.computeByCategory('risk')
    const curves = this.buildCurves()
    return new RiskReport(riskMetrics, [curves.drawdown, curves.exposure])
  }

  /** Generate a Summary Report (key metrics only) */
  summaryReport(): SummaryReport {
    const all = this.computeAll()
    const curves = this.buildCurves()
    return new SummaryReport(all, [
      curves.equity,
      curves.balance,
      curves.drawdown,
      curves.exposure,
    ])
  }

  /** Generate all reports at once */
  allReports(): MetricsReport[] {
    return [
      this.performanceReport(),
      this.riskReport(),
      this.summaryReport(),
    ]
  }

  // ═══════════════════════════════════
  // Snapshot
  // ═══════════════════════════════════

  snapshot(): MetricsSnapshot {
    const metrics = this.computeAll()
    const curves = Object.values(this.buildCurves())
    const reports = this.allReports()
    return createSnapshot(this.tradeCollector.size, metrics, curves, reports)
  }

  // ═══════════════════════════════════
  // Status
  // ═══════════════════════════════════

  getStatus() {
    return {
      id: 'metrics-runtime',
      connected: this.connected,
      registeredMetrics: this.registry.size,
      tradeCount: this.tradeCollector.size,
      positionCount: this.positionCollector.openCount,
      equityPoints: this.equityCollector.equityPoints.length,
      eventCount: this.eventCollector.size,
    }
  }

  /** Reset all collectors */
  reset(): void {
    for (const collector of this.collectors) {
      collector.reset()
    }
    this.connected = false
  }
}
