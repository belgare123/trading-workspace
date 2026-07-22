/**
 * FailureInjector.ts — Core chaos orchestrator
 *
 * The central hub that manages active failure rules, selects matching
 * injections, and provides transport wrappers (wrapFetch, wrapWebSocket).
 *
 * All Bybit-specific code is strictly outside this module.
 * FailureInjector knows nothing about exchanges, brokers, or gateways.
 *
 * Observability:
 *   - IFailureObserver: rich observation for external consumers
 *     (StructuredLogger, RuntimeTelemetry, EventJournal, ChaosReport)
 *   - ChaosEventHandler: lightweight internal events (backward compat)
 *
 * @since 6.6
 */

import type { RandomSource } from './RandomSource'
import { SeededRandom } from './SeededRandom'
import type { InjectionRule, InjectionContext, InjectionAction } from './InjectionRule'
import { FailureInjectionScope } from './InjectionRule'
import type { FailureProfile } from './FailureProfile'
import type { FailureScenario, ScenarioStep } from './FailureScenario'
import type { IFailureObserver, FailureObservation } from './IFailureObserver'
import { NoopFailureObserver, CompositeFailureObserver } from './IFailureObserver'

// ── Timeline controller ──

interface TimelineHandle {
  scenario: FailureScenario
  stepIndex: number
  startTime: number
  timers: Array<ReturnType<typeof setTimeout>>
}

// ── Internal event types (ChaosEventHandler) ──

export interface ChaosEvent {
  timestamp: number
  type: 'rule_added' | 'rule_removed' | 'rules_cleared' | 'profile_set'
    | 'injection_applied' | 'scenario_start' | 'scenario_step' | 'scenario_end'
  detail: Record<string, unknown>
}

export type ChaosEventHandler = (event: ChaosEvent) => void

// ════════════════════════════════════════════

export class FailureInjector {
  private rules: InjectionRule[] = []
  private random: RandomSource
  private timelineHandle: TimelineHandle | null = null
  private listeners: Set<ChaosEventHandler> = new Set()
  private observer: IFailureObserver

  constructor(random?: RandomSource, observer?: IFailureObserver) {
    this.random = random ?? new SeededRandom(Date.now())
    this.observer = observer ?? new NoopFailureObserver()
  }

  // ── Observer management ──

  /**
   * Replace the current IFailureObserver.
   * Use CompositeFailureObserver to fan out to multiple backends.
   */
  setObserver(observer: IFailureObserver): void {
    this.observer = observer
  }

  /** Convenience: wrap a CompositeFailureObserver */
  get compositeObserver(): CompositeFailureObserver | null {
    return this.observer instanceof CompositeFailureObserver ? this.observer : null
  }

  // ── Rule management ──

  get activeRules(): readonly InjectionRule[] {
    return this.rules
  }

  addRule(rule: InjectionRule): void {
    this.rules.push(rule)
    this.emit({ timestamp: Date.now(), type: 'rule_added', detail: { id: rule.id, scope: rule.scope } })
  }

  removeRule(ruleId: string): void {
    const removed = this.rules.filter(r => r.id === ruleId)
    this.rules = this.rules.filter(r => r.id !== ruleId)
    if (removed.length > 0) {
      this.emit({ timestamp: Date.now(), type: 'rule_removed', detail: { id: ruleId } })
    }
  }

  clearAll(): void {
    this.stopScenario()
    this.rules = []
    this.emit({ timestamp: Date.now(), type: 'rules_cleared', detail: {} })
  }

  // ── Profile management ──

  setProfile(profile: FailureProfile): void {
    this.rules = profile.rules.map(r => r.clone())
    this.emit({
      timestamp: Date.now(),
      type: 'profile_set',
      detail: { profileId: profile.id, ruleCount: this.rules.length },
    })
  }

  // ── Random source ──

  setSeed(seed: number): void {
    this.random = new SeededRandom(seed)
  }

  get randomSource(): RandomSource {
    return this.random
  }

  // ── Injection evaluation ──

  /**
   * Find all rules matching the given context.
   */
  matchingRules(context: InjectionContext): InjectionRule[] {
    return this.rules.filter(r => {
      if (!r.matches(context)) return false
      if (r.scope === FailureInjectionScope.GLOBAL) return true
      return r.scope === context.scope
    })
  }

  /**
   * Evaluate matching rules and return the action to apply.
   * Rolls probability for each matching rule; the first rule whose
   * probability fires wins (weighted fallthrough).
   *
   * Notifies observers on rule match and injection start.
   */
  async evaluate(context: InjectionContext): Promise<InjectionAction> {
    const matching = this.matchingRules(context)
    for (const rule of matching) {
      if (this.random.next() < rule.probability) {
        const action = rule.getAction(context, this.random)
        if (action.type !== 'none') {
          // Notify ChaosEventHandler (legacy)
          this.emit({
            timestamp: Date.now(),
            type: 'injection_applied',
            detail: { ruleId: rule.id, scope: rule.scope, action: action.type },
          })
          // Notify IFailureObserver
          this.observe({
            type: 'rule_matched',
            timestamp: Date.now(),
            context: { ...context },
            action: { ...action },
            ruleId: rule.id,
          })
          this.observe({
            type: 'injection_started',
            timestamp: Date.now(),
            context: { ...context },
            action: { ...action },
            ruleId: rule.id,
          })
        }
        return action
      }
    }
    return { type: 'none' }
  }

  /**
   * Synchronous version of evaluate for non-async callers.
   * Still returns Promise because rules may be async in future.
   */
  evaluateSync(context: InjectionContext): InjectionAction {
    const matching = this.matchingRules(context)
    for (const rule of matching) {
      if (this.random.next() < rule.probability) {
        const action = rule.getAction(context, this.random)
        if (action.type !== 'none') {
          this.emit({
            timestamp: Date.now(),
            type: 'injection_applied',
            detail: { ruleId: rule.id, scope: rule.scope, action: action.type },
          })
          this.observe({
            type: 'rule_matched',
            timestamp: Date.now(),
            context: { ...context },
            action: { ...action },
            ruleId: rule.id,
          })
          this.observe({
            type: 'injection_started',
            timestamp: Date.now(),
            context: { ...context },
            action: { ...action },
            ruleId: rule.id,
          })
        }
        return action
      }
    }
    return { type: 'none' }
  }

  // ── Injection lifecycle (for wrappers) ──

  /**
   * Called by transport wrappers (WrappedFetch, WrappedWebSocket) after
   * an injection effect has been applied — latency sleep completed,
   * response returned, error thrown, etc.
   */
  injectionFinished(
    context: InjectionContext,
    action: InjectionAction,
    durationMs: number,
    error?: Error,
  ): void {
    this.observe({
      type: 'injection_finished',
      timestamp: Date.now(),
      context: { ...context },
      action: { ...action },
      durationMs,
      error: error?.message,
    })
  }

  // ── Scenario / Timeline ──

  /**
   * Execute a timeline-based scenario.
   * The injector clears all existing rules, then follows the scenario steps.
   */
  startScenario(scenario: FailureScenario): void {
    // Stop any active scenario
    this.stopScenario()

    // Clear existing rules
    this.rules = []

    // Set seed if provided
    if (scenario.seed !== undefined) {
      this.random = new SeededRandom(scenario.seed)
    }

    const startTime = Date.now()
    const timers: Array<ReturnType<typeof setTimeout>> = []

    this.emit({
      timestamp: startTime,
      type: 'scenario_start',
      detail: { scenarioId: scenario.id, stepCount: scenario.steps.length },
    })

    this.observe({
      type: 'scenario_started',
      timestamp: startTime,
      scenarioId: scenario.id,
    })

    for (const step of scenario.steps) {
      const timer = setTimeout(() => {
        this.executeStep(step)
      }, step.at)
      timers.push(timer)
    }

    this.timelineHandle = {
      scenario,
      stepIndex: 0,
      startTime,
      timers,
    }
  }

  stopScenario(): void {
    if (this.timelineHandle) {
      for (const timer of this.timelineHandle.timers) {
        clearTimeout(timer)
      }
      const durationMs = Date.now() - this.timelineHandle.startTime
      this.emit({
        timestamp: Date.now(),
        type: 'scenario_end',
        detail: { scenarioId: this.timelineHandle.scenario.id },
      })
      this.observe({
        type: 'scenario_stopped',
        timestamp: Date.now(),
        scenarioId: this.timelineHandle.scenario.id,
        durationMs,
      })
      this.timelineHandle = null
    }
  }

  get activeScenario(): FailureScenario | null {
    return this.timelineHandle?.scenario ?? null
  }

  // ── Events (ChaosEventHandler — legacy compat) ──

  on(handler: ChaosEventHandler): () => void {
    this.listeners.add(handler)
    return () => this.listeners.delete(handler)
  }

  // ── Private ──

  private executeStep(step: ScenarioStep): void {
    this.emit({
      timestamp: Date.now(),
      type: 'scenario_step',
      detail: { at: step.at, action: step.action.type, description: step.description },
    })

    switch (step.action.type) {
      case 'inject':
        this.addRule(step.action.rule)
        break
      case 'clear':
        if (step.action.ruleId) {
          this.removeRule(step.action.ruleId)
        }
        break
      case 'clear_all':
        this.rules = []
        break
      case 'switch_profile':
        // Profile is resolved at scenario-build time; if passed as string,
        // caller must resolve. Here we assume it's a FailureProfile object.
        break
      case 'wait':
        // Already handled by setTimeout timing
        break
      case 'assert':
        // Assertions are handled externally by the Chaos Report / runner
        break
    }
  }

  private emit(event: ChaosEvent): void {
    for (const handler of this.listeners) {
      try { handler(event) } catch { /* swallow */ }
    }
  }

  private observe(event: FailureObservation): void {
    try {
      this.observer.observe(event)
    } catch { /* swallow */ }
  }
}
