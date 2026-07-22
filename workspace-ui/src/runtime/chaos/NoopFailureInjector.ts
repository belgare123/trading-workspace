/**
 * NoopFailureInjector.ts — Pass-through implementation for production use
 *
 * When chaos runtime is not active, this injector replaces the real one.
 * Every request passes through without any latency, timeout, or mutation.
 * Zero overhead in production when chaos features are compiled out.
 *
 * Usage:
 *   const injector = isChaosEnabled ? new FailureInjector() : new NoopFailureInjector()
 *
 * @since 6.6
 */

import type { RandomSource } from './RandomSource'
import type { InjectionRule, InjectionContext, InjectionAction } from './InjectionRule'
import type { FailureProfile } from './FailureProfile'
import type { FailureScenario } from './FailureScenario'
import type { IFailureObserver } from './IFailureObserver'
import type { ChaosEventHandler } from './FailureInjector'

export class NoopFailureInjector {
  get activeRules(): readonly InjectionRule[] {
    return []
  }

  addRule(_rule: InjectionRule): void {
    // noop
  }

  removeRule(_ruleId: string): void {
    // noop
  }

  clearAll(): void {
    // noop
  }

  setProfile(_profile: FailureProfile): void {
    // noop
  }

  setSeed(_seed: number): void {
    // noop
  }

  setObserver(_observer: IFailureObserver): void {
    // noop
  }

  get compositeObserver(): null {
    return null
  }

  matchingRules(_context: InjectionContext): InjectionRule[] {
    return []
  }

  async evaluate(_context: InjectionContext): Promise<InjectionAction> {
    return { type: 'none' }
  }

  evaluateSync(_context: InjectionContext): InjectionAction {
    return { type: 'none' }
  }

  injectionFinished(
    _context: InjectionContext,
    _action: InjectionAction,
    _durationMs: number,
    _error?: Error,
  ): void {
    // noop
  }

  startScenario(_scenario: FailureScenario): void {
    // noop
  }

  stopScenario(): void {
    // noop
  }

  get activeScenario(): FailureScenario | null {
    return null
  }

  on(_handler: ChaosEventHandler): () => void {
    return () => { /* noop */ }
  }

  get randomSource(): RandomSource {
    return Math as unknown as RandomSource
  }
}
