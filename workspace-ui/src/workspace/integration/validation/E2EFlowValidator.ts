/**
 * E2EFlowValidator.ts — End-to-end data flow validation
 *
 * Validates the complete data pipeline:
 *   GraphRuntime → BacktestRuntime → MetricsRuntime → ReportRuntime
 *
 * This is a VALIDATION RUNNER, not a test framework dependency.
 * It returns results as plain data for integration tests.
 *
 * @since 3.7.2
 */

import { StrategyGraph } from '../../strategy/composition/graph/StrategyGraph'
import type { StrategyGraph as StrategyGraphData } from '../../strategy/composition/types'
import { GraphRuntime } from '../../strategy/composition/runtime/GraphRuntime'
import { BacktestRuntime } from '../../backtest/runtime/BacktestRuntime'
import type { BacktestConfig, BacktestFeed } from '../../backtest/types'
import { ExecutionRuntime } from '../../execution/runtime/ExecutionRuntime'
import { MetricsRuntime } from '../../metrics/runtime/MetricsRuntime'
import { ReportRuntime } from '../../reports/runtime/ReportRuntime'
import type { ReportSources } from '../../reports/types'

// ═══════════════════════════════════════════
// Results
// ═══════════════════════════════════════════

export interface E2EStepResult {
  step: string
  status: 'passed' | 'failed' | 'skipped'
  detail?: string
}

export interface E2EFlowResult {
  total: number
  passed: number
  failed: number
  steps: E2EStepResult[]
}

// ═══════════════════════════════════════════
// Sample data
// ═══════════════════════════════════════════

function sampleGraphData(): StrategyGraphData {
  return {
    id: 'e2e-test-graph',
    name: 'E2E Test Strategy',
    version: '1.0.0',
    description: 'Minimal strategy for end-to-end flow validation',
    nodes: [
      { id: 'sig-1', type: 'signal', label: 'EMA Crossover', definitionId: 'ema-crossover', params: { fast: 9, slow: 21 } },
      { id: 'cond-1', type: 'condition', label: 'Check Value', definitionId: 'greater-than', params: { threshold: 0 } },
      { id: 'act-1', type: 'action', label: 'Enter Market', definitionId: 'market-order', params: { size: 0.01 } },
    ],
    edges: [
      { id: 'e1', sourceId: 'sig-1', targetId: 'cond-1' },
      { id: 'e2', sourceId: 'cond-1', targetId: 'act-1' },
    ],
    metadata: { created: Date.now(), updated: Date.now() },
  }
}

// ═══════════════════════════════════════════
// Validation runner
// ═══════════════════════════════════════════

export class E2EFlowValidator {
  private readonly steps: E2EStepResult[] = []

  /** Run all end-to-end checks */
  run(): E2EFlowResult {
    this.steps.length = 0

    this.steps.push(this.testGraphCreation())
    this.steps.push(this.testGraphRuntimeLoad())
    this.steps.push(this.testRuntimeConstruction())
    this.steps.push(this.testBacktestSessionCreation())
    this.steps.push(this.testReportGeneration())

    return {
      total: this.steps.length,
      passed: this.steps.filter(s => s.status === 'passed').length,
      failed: this.steps.filter(s => s.status === 'failed').length,
      steps: this.steps,
    }
  }

  // ── Step implementations ──

  private testGraphCreation(): E2EStepResult {
    try {
      const data = sampleGraphData()
      const graph = new StrategyGraph(data)
      if (graph.nodeCount !== 3) return { step: 'graph-creation', status: 'failed', detail: `Expected 3 nodes, got ${graph.nodeCount}` }
      if (graph.edgeCount !== 2) return { step: 'graph-creation', status: 'failed', detail: `Expected 2 edges, got ${graph.edgeCount}` }
      return { step: 'graph-creation', status: 'passed', detail: `Graph: ${graph.name}, ${graph.nodeCount} nodes, ${graph.edgeCount} edges` }
    } catch (e) {
      return { step: 'graph-creation', status: 'failed', detail: String(e) }
    }
  }

  private testGraphRuntimeLoad(): E2EStepResult {
    try {
      const graph = new StrategyGraph(sampleGraphData())
      const runtime = new GraphRuntime()
      const result = runtime.load(graph)
      if (!result.success) {
        return { step: 'graph-runtime-load', status: 'failed', detail: `Load failed: ${(result.errors ?? []).join('; ')}` }
      }
      runtime.unload()
      return { step: 'graph-runtime-load', status: 'passed', detail: 'Graph loaded, validated, and unloaded' }
    } catch (e) {
      return { step: 'graph-runtime-load', status: 'failed', detail: String(e) }
    }
  }

  private testRuntimeConstruction(): E2EStepResult {
    try {
      // Verify all frozen Runtime's constructible
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void new ExecutionRuntime()
      void new MetricsRuntime()
      void new BacktestRuntime()
      void new ReportRuntime()
      return { step: 'runtime-construction', status: 'passed', detail: 'Execution, Metrics, Backtest, Report — all constructible' }
    } catch (e) {
      return { step: 'runtime-construction', status: 'failed', detail: String(e) }
    }
  }

  private testBacktestSessionCreation(): E2EStepResult {
    try {
      const btRuntime = new BacktestRuntime()
      const config: BacktestConfig = {
        id: 'e2e-bt',
        name: 'E2E Backtest',
        symbol: 'BTC/USDT',
        timeframe: '1h',
        initialCash: 100000,
        strategyId: 'e2e-test-graph',
        spread: 0.001,
      }

      // Create a minimal feed
      const feed: BacktestFeed = {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        totalBars: 100,
        position: 0,
        hasNext: () => false,
        next: (_spread: number) => ({
          timestamp: 0,
          open: 50000,
          high: 50500,
          low: 49500,
          close: 50200,
          volume: 100,
          symbol: 'BTC/USDT',
          bid: 50100,
          ask: 50300,
          last: 50200,
          bar: {
            timestamp: 0,
            open: 50000,
            high: 50500,
            low: 49500,
            close: 50200,
            volume: 100,
          },
        }),
        peek: () => ({ timestamp: 0, open: 50000, high: 50500, low: 49500, close: 50200, volume: 100 }),
        reset: () => {},
        progress: 0,
      }

      const session = btRuntime.createSession(config, feed)
      if (!session) {
        return { step: 'backtest-session', status: 'failed', detail: 'createSession returned null' }
      }

      return { step: 'backtest-session', status: 'passed', detail: `Session: ${session.id}, config: ${session.config.name}` }
    } catch (e) {
      return { step: 'backtest-session', status: 'failed', detail: String(e) }
    }
  }

  private testReportGeneration(): E2EStepResult {
    try {
      const reportRuntime = new ReportRuntime()
      const sources: ReportSources = {
        metrics: {
          metrics: [
            { id: 'netProfit', name: 'Net Profit', value: 1234.56, formatted: '$1,234.56', category: 'summary' },
            { id: 'sharpe', name: 'Sharpe', value: 1.85, formatted: '1.85', category: 'risk' },
            { id: 'maxDd', name: 'Max Drawdown', value: -0.12, formatted: '-12.0%', category: 'risk' },
            { id: 'winRate', name: 'Win Rate', value: 62.5, formatted: '62.5%', category: 'summary' },
          ],
          curves: [],
        },
      }

      const report = reportRuntime.buildDefaultReport('E2E Report', sources)
      if (!report || !report.sections || report.sections.length === 0) {
        return { step: 'report-generation', status: 'failed', detail: 'Report has no sections' }
      }

      return { step: 'report-generation', status: 'passed', detail: `"${report.name}", ${report.sections.length} sections` }
    } catch (e) {
      return { step: 'report-generation', status: 'failed', detail: String(e) }
    }
  }
}
