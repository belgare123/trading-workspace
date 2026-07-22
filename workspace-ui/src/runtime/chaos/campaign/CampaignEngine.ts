/**
 * CampaignEngine.ts — Declarative Chaos Campaign DSL
 *
 * Sprint 6.6.6 — Full Chaos Campaign (Block 1)
 *
 * A Campaign is a time-sequenced orchestration of failure injections,
 * recoveries, assertions, and certifications. It replaces ad-hoc test
 * scenarios with a declarative, reproducible, measurable process.
 *
 * Usage:
 *   const campaign = new CampaignEngine('Exchange Outage')
 *     .at(2000).inject(new LatencyRule(...))
 *     .at(4000).inject(new TimeoutRule(...))
 *     .at(5000).inject(new DisconnectRule(...))
 *     .at(6000).assert(assertGatewayHealthy)
 *     .at(8000).recover(FailureInjectionScope.REST)
 *     .at(9000).recover(FailureInjectionScope.PRIVATE_WS)
 *     .at(12000).certify()
 *
 *   const result = await campaign.run(injector, context)
 *   console.log(result.text())
 *
 * @since 6.6.6
 */

import { FailureInjectionScope } from '../InjectionRule'
import type { InjectionRule } from '../InjectionRule'
import type { FailureInjector } from '../FailureInjector'

// ── Types ──

export type CampaignActionType = 'inject' | 'recover' | 'assert' | 'certify'

export interface AssertSpec {
  name: string
  fn: (ctx: CampaignContext) => CampaignAssertion | Promise<CampaignAssertion>
}

export interface CampaignStepDef {
  offsetMs: number
  action: CampaignActionType
  label: string
  spec: InjectionRule | FailureInjectionScope | AssertSpec | null
}

export type CampaignAssertionStatus = 'passed' | 'failed' | 'skipped'

export interface CampaignAssertion {
  name: string
  status: CampaignAssertionStatus
  detail?: string
  durationMs?: number
}

export interface CampaignStepResult {
  step: CampaignStepDef
  startedAt: number
  completedAt: number
  durationMs: number
  pass: boolean
  assertions: CampaignAssertion[]
  error?: string
}

export interface SLOResult {
  name: string
  targetMs: number
  actualMs: number
  pass: boolean
}

export interface CampaignContext {
  /** Collect assertions during campaign execution */
  pushAssertion(assertion: CampaignAssertion): void
  /** Record an SLO measurement */
  recordSLO(name: string, targetMs: number, actualMs: number): void
  /** Get all assertions so far */
  getAssertions(): CampaignAssertion[]
  /** Get all SLO results so far */
  getSLOs(): SLOResult[]
  /** Dependencies injected into the campaign */
  deps: CampaignDependencies
}

export interface CampaignDependencies {
  injector?: FailureInjector
  /** Optional store for incident data */
  onEvent?: (event: CampaignEvent) => void
}

export interface CampaignEvent {
  phase: 'step_start' | 'step_end' | 'injection' | 'recovery' | 'assertion' | 'certification' | 'campaign_end'
  timestamp: number
  stepIndex: number
  stepLabel: string
  data: Record<string, unknown>
}

export interface CampaignReport {
  name: string
  startTime: number
  endTime: number
  durationMs: number
  steps: CampaignStepResult[]
  assertions: CampaignAssertion[]
  sloResults: SLOResult[]
  totalAssertions: number
  passedAssertions: number
  failedAssertions: number
  allPass: boolean
  text(): string
}

export interface CampaignConfig {
  /** Virtual time multiplier (1 = real time, 0 = immediate) */
  timeMultiplier?: number
  /** Label for this campaign */
  label?: string
}

// ════════════════════════════════════════════
// CampaignEngine — the declarative DSL
// ════════════════════════════════════════════

export class CampaignEngine {
  readonly name: string
  private steps: CampaignStepDef[] = []
  private config: Required<CampaignConfig>

  constructor(name: string, config?: CampaignConfig) {
    this.name = name
    this.config = {
      timeMultiplier: 1,
      label: name,
      ...config,
    }
  }

  // ── DSL Methods ──

  /** Schedule a failure injection at a time offset */
  at(offsetMs: number): CampaignTimelineBuilder {
    return new CampaignTimelineBuilder(this, offsetMs)
  }

  /** Add a standalone assertion (runs immediately after the previous step) */
  assert(spec: AssertSpec): this {
    this.steps.push({
      offsetMs: 0,
      action: 'assert',
      label: spec.name,
      spec,
    })
    return this
  }

  /** Final certification step — evaluates all assertions and generates report */
  certify(): this {
    this.steps.push({
      offsetMs: 0,
      action: 'certify',
      label: 'certification',
      spec: null,
    })
    return this
  }

  /** Add a raw step (internal / builder use) */
  addStep(step: CampaignStepDef): this {
    this.steps.push(step)
    return this
  }

  // ── Execution ──

  /**
   * Run the campaign with the given dependencies.
   * Returns a CampaignReport with all results.
   */
  async run(deps: CampaignDependencies): Promise<CampaignReport> {
    const startTime = Date.now()
    const steps: CampaignStepResult[] = []
    const assertions: CampaignAssertion[] = []
    const sloResults: SLOResult[] = []
    const events: CampaignEvent[] = []

    const ctx = this.createContext(deps, assertions, sloResults, events)

    // Sort steps by offset
    const sorted = [...this.steps].sort((a, b) => a.offsetMs - b.offsetMs)

    let prevOffset = 0

    for (let i = 0; i < sorted.length; i++) {
      const step = sorted[i]

      // Virtual time delay
      if (step.offsetMs > 0) {
        const delay = Math.round((step.offsetMs - prevOffset) * this.config.timeMultiplier)
        if (delay > 0) {
          await this.sleep(delay)
        }
        prevOffset = step.offsetMs
      }

      this.emitEvent(ctx, {
        phase: 'step_start',
        timestamp: Date.now(),
        stepIndex: i,
        stepLabel: step.label,
        data: { action: step.action, spec: step.spec },
      })

      const stepResult = await this.executeStep(step, ctx, i)

      this.emitEvent(ctx, {
        phase: 'step_end',
        timestamp: Date.now(),
        stepIndex: i,
        stepLabel: step.label,
        data: { pass: stepResult.pass, durationMs: stepResult.durationMs },
      })

      steps.push(stepResult)
    }

    this.emitEvent(ctx, {
      phase: 'campaign_end',
      timestamp: Date.now(),
      stepIndex: -1,
      stepLabel: '',
      data: { steps: steps.length, allPass: steps.every(s => s.pass) },
    })

    const endTime = Date.now()

    return this.buildReport(this.name, startTime, endTime, steps, assertions, sloResults)
  }

  // ── Private ──

  private createContext(
    deps: CampaignDependencies,
    assertions: CampaignAssertion[],
    slos: SLOResult[],
    events: CampaignEvent[],
  ): CampaignContext {
    return {
      deps,
      pushAssertion(a: CampaignAssertion) { assertions.push(a) },
      recordSLO(name: string, targetMs: number, actualMs: number) {
        slos.push({ name, targetMs, actualMs, pass: actualMs <= targetMs })
      },
      getAssertions: () => [...assertions],
      getSLOs: () => [...slos],
    }
  }

  private emitEvent(ctx: CampaignContext, event: CampaignEvent): void {
    ctx.deps.onEvent?.(event)
  }

  private async executeStep(
    step: CampaignStepDef,
    ctx: CampaignContext,
    index: number,
  ): Promise<CampaignStepResult> {
    const startedAt = Date.now()
    const stepAssertions: CampaignAssertion[] = []
    let pass = true
    let error: string | undefined

    try {
      switch (step.action) {
        case 'inject': {
          const rule = step.spec as InjectionRule
          this.handleInject(rule, ctx, index)
          this.emitEvent(ctx, {
            phase: 'injection',
            timestamp: Date.now(),
            stepIndex: index,
            stepLabel: step.label,
            data: { ruleId: rule.id, scope: rule.scope },
          })
          break
        }

        case 'recover': {
          const scope = step.spec as FailureInjectionScope
          this.handleRecover(scope, ctx, index)
          this.emitEvent(ctx, {
            phase: 'recovery',
            timestamp: Date.now(),
            stepIndex: index,
            stepLabel: step.label,
            data: { scope },
          })
          break
        }

        case 'assert': {
          const spec = step.spec as AssertSpec
          const assertStart = Date.now()
          let result: CampaignAssertion

          try {
            result = await spec.fn(ctx)
          } catch (err) {
            result = {
              name: spec.name,
              status: 'failed',
              detail: `Assertion threw: ${err instanceof Error ? err.message : String(err)}`,
            }
          }

          result.durationMs = Date.now() - assertStart
          stepAssertions.push(result)
          ctx.pushAssertion(result)

          this.emitEvent(ctx, {
            phase: 'assertion',
            timestamp: Date.now(),
            stepIndex: index,
            stepLabel: step.label,
            data: { name: result.name, status: result.status, detail: result.detail },
          })

          if (result.status === 'failed') {
            pass = false
            error = result.detail
          }
          break
        }

        case 'certify': {
          const allAssertions = ctx.getAssertions()
          const failed = allAssertions.filter(a => a.status === 'failed')
          if (failed.length > 0) {
            pass = false
            error = `Certification failed: ${failed.length}/${allAssertions.length} assertions failed`
          }

          this.emitEvent(ctx, {
            phase: 'certification',
            timestamp: Date.now(),
            stepIndex: index,
            stepLabel: step.label,
            data: { total: allAssertions.length, failed: failed.length, passed: allAssertions.length - failed.length },
          })
          break
        }
      }
    } catch (err) {
      pass = false
      error = err instanceof Error ? err.message : String(err)
    }

    const completedAt = Date.now()
    return {
      step,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      pass,
      assertions: stepAssertions,
      error,
    }
  }

  private handleInject(rule: InjectionRule, _ctx: CampaignContext, _stepIndex: number): void {
    const injector = _ctx.deps.injector
    if (!injector) return
    injector.addRule(rule)
  }

  private handleRecover(scope: FailureInjectionScope, ctx: CampaignContext, _stepIndex: number): void {
    const injector = ctx.deps.injector
    if (!injector) return
    injector.removeScope(scope)
  }

  private buildReport(
    name: string,
    startTime: number,
    endTime: number,
    steps: CampaignStepResult[],
    assertions: CampaignAssertion[],
    sloResults: SLOResult[],
  ): CampaignReport {
    const totalAssertions = assertions.length
    const passedAssertions = assertions.filter(a => a.status === 'passed').length
    const failedAssertions = assertions.filter(a => a.status === 'failed').length
    const allPass = steps.every(s => s.pass) && failedAssertions === 0

    return {
      name,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      steps,
      assertions,
      sloResults,
      totalAssertions,
      passedAssertions,
      failedAssertions,
      allPass,
      text(): string {
        const lines: string[] = [
          `Campaign:          ${name}`,
          `Duration:          ${Math.round((endTime - startTime) / 1000)}s`,
          `Steps:             ${steps.length}`,
          `Passed:            ${steps.filter(s => s.pass).length}`,
          `Failed:            ${steps.filter(s => !s.pass).length}`,
          `Assertions:        ${totalAssertions}`,
          `  Passed:          ${passedAssertions}`,
          `  Failed:          ${failedAssertions}`,
          `SLOs:              ${sloResults.length}`,
          `  Violations:      ${sloResults.filter(s => !s.pass).length}`,
          `Status:            ${allPass ? 'PASS' : 'FAIL'}`,
          ``,
        ]

        if (sloResults.filter(s => !s.pass).length > 0) {
          lines.push('SLO Violations:')
          for (const slo of sloResults.filter(s => !s.pass)) {
            lines.push(`  ${slo.name}: ${slo.actualMs}ms (target: ${slo.targetMs}ms)`)
          }
          lines.push('')
        }

        if (failedAssertions > 0) {
          lines.push('Failed Assertions:')
          for (const a of assertions.filter(a => a.status === 'failed')) {
            lines.push(`  ${a.name}: ${a.detail ?? 'no detail'}`)
          }
          lines.push('')
        }

        return lines.join('\n')
      },
    }
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve()
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ════════════════════════════════════════════
// CampaignTimelineBuilder — fluently builds steps
// ════════════════════════════════════════════

export class CampaignTimelineBuilder {
  constructor(
    private engine: CampaignEngine,
    private offsetMs: number,
  ) {}

  inject(rule: InjectionRule): CampaignEngine {
    return this.engine.addStep({
      offsetMs: this.offsetMs,
      action: 'inject',
      label: `inject:${rule.id}`,
      spec: rule,
    })
  }

  /** Remove all failure rules for a given transport scope */
  recover(scope: FailureInjectionScope): CampaignEngine {
    return this.engine.addStep({
      offsetMs: this.offsetMs,
      action: 'recover',
      label: `recover:${scope}`,
      spec: scope,
    })
  }

  /** Run an assertion at this timeline offset */
  assert(spec: AssertSpec): CampaignEngine {
    return this.engine.addStep({
      offsetMs: this.offsetMs,
      action: 'assert',
      label: spec.name,
      spec,
    })
  }

  /** Run the final certification at this offset */
  certify(): CampaignEngine {
    return this.engine.addStep({
      offsetMs: this.offsetMs,
      action: 'certify',
      label: 'certification',
      spec: null,
    })
  }
}
