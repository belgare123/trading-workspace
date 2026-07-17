/**
 * CertificationRuntime.ts — Orchestrates certification suite execution
 *
 * API:
 *   const runtime = new CertificationRuntime(broker, gateway?)
 *   runtime.registerBuiltins()            // register all 75 builtin scenarios
 *   const report = await runtime.run()    // execute all + return report
 *   console.log(runtime.formatReport())   // pretty-print
 *
 * @since 4.9
 */

import type { BrokerAdapter } from '../live/live/BrokerAdapter'
import type { GatewayRuntime } from '../live/gateway/GatewayRuntime'
import type {
  ScenarioDefinition,
  ScenarioContext,
  ScenarioFilter,
  ScenarioResult,
  ScenarioOutcome,
} from './ScenarioDefinition'
import { ScenarioRegistry } from './ScenarioRegistry'
import { ScenarioRunner } from './ScenarioRunner'
import { CertificationReportBuilder, type CertificationReport } from './CertificationReport'

import { connectivityScenarios } from './builtins/ConnectivityScenarios'
import { orderScenarios } from './builtins/OrderScenarios'
import { riskScenarios } from './builtins/RiskScenarios'
import { recoveryScenarios } from './builtins/RecoveryScenarios'
import { infrastructureScenarios } from './builtins/InfrastructureScenarios'
import { historyScenarios } from './builtins/HistoryScenarios'
import { metricsScenarios } from './builtins/MetricsScenarios'

export interface CertificationRuntimeConfig {
  /** Default per-scenario timeout in ms */
  defaultTimeoutMs?: number
  /** Stop on first failure */
  failFast?: boolean
  /** Run scenarios in parallel batches (default: sequential) */
  batchSize?: number
}

const DEFAULT_CONFIG: Required<CertificationRuntimeConfig> = {
  defaultTimeoutMs: 15_000,
  failFast: false,
  batchSize: 1,
}

export type CertificationProgressCallback = (progress: {
  current: number
  total: number
  result: ScenarioResult | null
}) => void

export class CertificationRuntime {
  readonly registry: ScenarioRegistry
  readonly runner: ScenarioRunner
  readonly reportBuilder: CertificationReportBuilder
  readonly config: Required<CertificationRuntimeConfig>

  private broker: BrokerAdapter
  private gateway?: GatewayRuntime
  private ctx: ScenarioContext
  private onProgress?: CertificationProgressCallback

  private _isRunning = false
  private _abortController: AbortController | null = null

  constructor(
    broker: BrokerAdapter,
    gateway?: GatewayRuntime,
    config?: CertificationRuntimeConfig,
  ) {
    this.broker = broker
    this.gateway = gateway
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.registry = new ScenarioRegistry()
    this.reportBuilder = new CertificationReportBuilder()

    this.ctx = this.createContext()
    this.runner = new ScenarioRunner(this.ctx, {
      defaultTimeoutMs: this.config.defaultTimeoutMs,
      failFast: this.config.failFast,
    })
  }

  /** Register all 75 builtin scenarios */
  registerBuiltins(): void {
    this.registry.registerAll(
      ...connectivityScenarios(),
      ...orderScenarios(),
      ...riskScenarios(),
      ...recoveryScenarios(),
      ...infrastructureScenarios(),
      ...historyScenarios(),
      ...metricsScenarios(),
    )
  }

  /** Register a single custom scenario */
  register(scenario: ScenarioDefinition): void {
    this.registry.register(scenario)
  }

  /** Register multiple custom scenarios */
  registerAll(...scenarios: ScenarioDefinition[]): void {
    this.registry.registerAll(...scenarios)
  }

  /** Verify scenario counts match expectations */
  verifyCounts(expected: Record<string, number>): string[] {
    return this.registry.verifyCounts(expected)
  }

  /**
   * Run the certification suite
   *
   * @returns CertificationReport — structured results
   */
  async run(filter?: ScenarioFilter): Promise<CertificationReport> {
    if (this._isRunning) {
      throw new Error('CertificationRuntime: already running')
    }

    this._isRunning = true
    this._abortController = new AbortController()
    this.reportBuilder.start()

    try {
      const scenarios = this.registry.filter(filter)
      this.ctx = this.createContext()

      const results: ScenarioResult[] = []

      if (this.config.batchSize > 1) {
        // Batched parallel execution
        const batchedResults = await this.runner.runBatched(scenarios, this.config.batchSize)
        results.push(...batchedResults)
      } else {
        // Sequential execution with progress
        for (let i = 0; i < scenarios.length; i++) {
          if (this.ctx.signal?.aborted) break

          const result = await this.runner.run(scenarios[i])
          results.push(result)

          this.onProgress?.({
            current: i + 1,
            total: scenarios.length,
            result,
          })
        }
      }

      return this.reportBuilder.build(results)
    } finally {
      this._isRunning = false
      this._abortController = null
    }
  }

  /** Abort a running certification suite */
  cancel(): void {
    this._abortController?.abort()
  }

  /** Check if a suite is currently running */
  get isRunning(): boolean {
    return this._isRunning
  }

  /** Set progress callback */
  onProgress(cb: CertificationProgressCallback): () => void {
    this.onProgress = cb
    return () => {
      this.onProgress = undefined
    }
  }

  /** Format the last report as a human-readable string */
  static formatReport(report: CertificationReport): string {
    return CertificationReportBuilder.format(report)
  }

  /** Format report as JSON */
  static reportToJson(report: CertificationReport): string {
    return CertificationReportBuilder.toJson(report)
  }

  // ── Private ──

  private createContext(): ScenarioContext {
    const signal = this._abortController?.signal

    return {
      broker: this.broker,
      gateway: this.gateway,
      signal,
      log: (msg: string) => {
        if (typeof console !== 'undefined') console.log(`[Cert] ${msg}`)
      },
      assert: (condition: boolean, message: string): asserts condition => {
        if (!condition) throw new Error(`Assertion failed: ${message}`)
      },
      assertEqual: <T>(actual: T, expected: T, message?: string) => {
        if (actual !== expected) {
          throw new Error(
            message
              ? `AssertEqual failed: ${message} (actual=${JSON.stringify(actual)}, expected=${JSON.stringify(expected)})`
              : `AssertEqual failed: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
          )
        }
      },
      assertOk: (value: unknown, message?: string): asserts value => {
        if (!value) throw new Error(message ?? 'AssertOk failed')
      },
      waitFor: async (
        predicate: () => boolean | Promise<boolean>,
        timeoutMs = 10_000,
        intervalMs = 200,
      ): Promise<void> => {
        const deadline = Date.now() + timeoutMs
        while (Date.now() < deadline) {
          if (signal?.aborted) throw new Error('Aborted')
          if (await predicate()) return
          await new Promise((r) => setTimeout(r, intervalMs))
        }
        throw new Error(`waitFor timed out after ${timeoutMs}ms`)
      },
      sleep: (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms)),
    }
  }
}
