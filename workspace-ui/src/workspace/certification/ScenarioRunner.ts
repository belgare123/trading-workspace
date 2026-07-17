/**
 * ScenarioRunner.ts — Executes a scenario with timeout, error isolation, and context injection
 *
 * Each scenario runs in a sandboxed context with helpers (assert, waitFor, log, sleep).
 * Timeout protection ensures a stuck scenario never blocks the full suite.
 *
 * @since 4.9
 */

import type {
  ScenarioDefinition,
  ScenarioContext,
  ScenarioOutcome,
  ScenarioResult,
} from './ScenarioDefinition'

export interface ScenarioRunnerConfig {
  /** Default timeout per scenario in ms (default: 10_000) */
  defaultTimeoutMs?: number
  /** Whether to abort on first failure (default: false) */
  failFast?: boolean
}

const DEFAULT_CONFIG: Required<ScenarioRunnerConfig> = {
  defaultTimeoutMs: 10_000,
  failFast: false,
}

export class ScenarioRunner {
  private config: Required<ScenarioRunnerConfig>
  private ctx: ScenarioContext

  constructor(ctx: ScenarioContext, config?: ScenarioRunnerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ctx = ctx
  }

  /** Execute a single scenario */
  async run(scenario: ScenarioDefinition): Promise<ScenarioResult> {
    const startedAt = new Date().toISOString()

    // Check connection requirement
    if (scenario.requiresConnection && !this.ctx.broker.connection.isConnected()) {
      return {
        definition: scenario,
        outcome: { verdict: 'skipped', message: 'Broker not connected', durationMs: 0 },
        startedAt,
        skipped: true,
        skipReason: 'Broker not connected',
      }
    }

    // Check gateway requirement
    if (scenario.requiresGateway && !this.ctx.gateway) {
      return {
        definition: scenario,
        outcome: { verdict: 'skipped', message: 'GatewayRuntime not available', durationMs: 0 },
        startedAt,
        skipped: true,
        skipReason: 'GatewayRuntime not available',
      }
    }

    const timeoutMs = scenario.timeoutMs ?? this.config.defaultTimeoutMs

    try {
      const outcome = await this.executeWithTimeout(scenario, timeoutMs)
      return { definition: scenario, outcome, startedAt, skipped: false }
    } catch (err) {
      return {
        definition: scenario,
        outcome: {
          verdict: 'error',
          message: `Scenario threw unhandled error`,
          error: String(err),
          durationMs: 0,
        },
        startedAt,
        skipped: false,
      }
    }
  }

  /** Run multiple scenarios sequentially */
  async runAll(scenarios: ScenarioDefinition[]): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = []

    for (const scenario of scenarios) {
      if (this.ctx.signal?.aborted) break

      const result = await this.run(scenario)
      results.push(result)

      if (result.outcome.verdict === 'failed' && this.config.failFast) {
        break
      }
    }

    return results
  }

  /** Run multiple scenarios in parallel batches */
  async runBatched(
    scenarios: ScenarioDefinition[],
    batchSize = 4,
  ): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = []
    const queue = [...scenarios]

    while (queue.length > 0) {
      if (this.ctx.signal?.aborted) break

      const batch = queue.splice(0, batchSize)
      const batchResults = await Promise.all(
        batch.map((s) => this.run(s)),
      )
      results.push(...batchResults)

      // Check failFast
      if (this.config.failFast) {
        const failed = batchResults.find(
          (r) => r.outcome.verdict === 'failed',
        )
        if (failed) break
      }
    }

    return results
  }

  private async executeWithTimeout(
    scenario: ScenarioDefinition,
    timeoutMs: number,
  ): Promise<ScenarioOutcome> {
    const startTime = performance.now()

    const executionPromise = scenario.execute(this.ctx).then((outcome) => ({
      ...outcome,
      durationMs: outcome.durationMs || Math.round(performance.now() - startTime),
    }))

    const timeoutPromise = new Promise<ScenarioOutcome>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Scenario '${scenario.id}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    return await Promise.race([executionPromise, timeoutPromise])
  }
}
