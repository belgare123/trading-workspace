/**
 * DecisionLog.ts — Records the full Signal → Condition → Action chain
 *
 * Every strategy evaluation produces a DecisionRecord that captures:
 * - What signals triggered evaluation
 * - What conditions were checked and their results
 * - What action was taken and why
 * - Confidence and aggregate scores
 *
 * This is the core of auditability — answering "why was this trade made?"
 *
 * @since 4.4
 */

import type { DecisionRecord, SignalRecord, ConditionRecord, ActionRecord } from './types'

export class DecisionLog {
  private decisions: DecisionRecord[] = []
  private signals: SignalRecord[] = []
  private conditions: ConditionRecord[] = []
  private actions: ActionRecord[] = []
  private maxEntries: number

  constructor(maxEntries = 5_000) {
    this.maxEntries = maxEntries
  }

  // ── Raw signal/condition/action recording ──

  recordSignal(signal: SignalRecord): void {
    this.signals.push(signal)
    this.trimArray(this.signals)
  }

  recordCondition(condition: ConditionRecord): void {
    this.conditions.push(condition)
    this.trimArray(this.conditions)
  }

  recordAction(action: ActionRecord): void {
    this.actions.push(action)
    this.trimArray(this.actions)
  }

  // ── Decision recording ──

  recordDecision(decision: DecisionRecord): DecisionRecord {
    this.decisions.push(decision)
    this.trimArray(this.decisions)
    return decision
  }

  /** Convenience: build and record a decision from components */
  buildDecision(params: {
    strategyId: string
    symbol?: string
    signal?: { name: string; value: number; score: number }
    conditions: Array<{ expression: string; result: boolean; weight: number; score: number }>
    action: { name: string; confidence: number; reason: string }
    orderId?: string
    result?: 'executed' | 'skipped' | 'error'
    error?: string
  }): DecisionRecord {
    const aggScore = params.signal
      ? (params.signal.score + params.conditions.reduce((s, c) => s + c.score, 0)) / (1 + params.conditions.length)
      : params.conditions.reduce((s, c) => s + c.score, 0) / params.conditions.length

    const decision: DecisionRecord = {
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      strategyId: params.strategyId,
      timestamp: Date.now(),
      symbol: params.symbol,
      signal: params.signal,
      conditions: params.conditions,
      action: params.action,
      aggregateScore: aggScore,
      confidenceScore: params.action.confidence,
      orderId: params.orderId,
      result: params.result ?? 'executed',
      error: params.error,
    }

    this.decisions.push(decision)
    this.trimArray(this.decisions)
    return decision
  }

  // ── Queries ──

  getDecisions(n = 50): DecisionRecord[] {
    return this.decisions.slice(-n).reverse()
  }

  getDecisionsByStrategy(strategyId: string): DecisionRecord[] {
    return this.decisions.filter(d => d.strategyId === strategyId).reverse()
  }

  getDecisionsBySymbol(symbol: string): DecisionRecord[] {
    return this.decisions.filter(d => d.symbol === symbol).reverse()
  }

  getDecisionsByOrder(orderId: string): DecisionRecord[] {
    return this.decisions.filter(d => d.orderId === orderId)
  }

  getSignals(n = 100): SignalRecord[] {
    return this.signals.slice(-n)
  }

  getSignalsByStrategy(strategyId: string): SignalRecord[] {
    return this.signals.filter(s => s.strategyId === strategyId)
  }

  getByResult(result: 'executed' | 'skipped' | 'error'): DecisionRecord[] {
    return this.decisions.filter(d => d.result === result)
  }

  /** All decisions */
  all(): DecisionRecord[] {
    return [...this.decisions]
  }

  get size(): number {
    return this.decisions.length
  }

  clear(): void {
    this.decisions = []
    this.signals = []
    this.conditions = []
    this.actions = []
  }

  private trimArray<T>(arr: T[]): void {
    if (arr.length > this.maxEntries) {
      arr.splice(0, arr.length - this.maxEntries)
    }
  }
}
