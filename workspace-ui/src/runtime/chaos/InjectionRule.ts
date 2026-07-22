/**
 * InjectionRule.ts — Rule interface and all built-in implementations
 *
 * Each injection type is a separate class implementing InjectionRule.
 * Adding a new failure mode means writing a new class, not modifying the core.
 *
 * @since 6.6
 */

import type { RandomSource } from './RandomSource'

// ── Scope ──

export enum FailureInjectionScope {
  /** Applies to all traffic regardless of type */
  GLOBAL = 'global',
  /** REST HTTP calls */
  REST = 'rest',
  /** Public WebSocket (market data feed) */
  PUBLIC_WS = 'public_ws',
  /** Private WebSocket (umbrella — matches any private WS sub-scope) */
  PRIVATE_WS = 'private_ws',

  // ── Private WS semantic categories (6.6.4) ──
  /** Order execution reports (ACK, cancel/replace confirm) */
  PRIVATE_WS_EXECUTION = 'private_ws.execution',
  /** Order updates and status changes */
  PRIVATE_WS_ORDER = 'private_ws.order',
  /** Fill events (trades) — idempotency critical */
  PRIVATE_WS_FILL = 'private_ws.fill',
  /** Position updates */
  PRIVATE_WS_POSITION = 'private_ws.position',
  /** Wallet / balance updates */
  PRIVATE_WS_WALLET = 'private_ws.wallet',
  /** Account-level events */
  PRIVATE_WS_ACCOUNT = 'private_ws.account',

  /** Order placement / cancellation */
  ORDERS = 'orders',
  /** Position queries */
  POSITIONS = 'positions',
  /** Market data subscriptions */
  MARKET_DATA = 'market_data',
}

// ── Context ──

/**
 * Rich failure context for targeted injection rules.
 *
 * `scope` is always required. The remaining fields are optional
 * and allow rules to target specific operations, symbols, strategies,
 * or individual orders. All fields are populated by the transport
 * wrappers (WrappedFetch, WrappedWebSocket) and the integration
 * layer (GatewayRuntime, BrokerAdapter).
 */
export interface InjectionContext {
  scope: FailureInjectionScope
  url?: string
  method?: string
  requestBody?: unknown
  messageType?: string
  messageData?: unknown
  timestamp: number

  // ── Rich failure context (optional, for targeted rules) ──
  /** High-level operation name (e.g. 'placeOrder', 'cancelOrder', 'getBalances') */
  operation?: string
  /** Trading symbol (e.g. 'XRPUSDT', 'BTCUSDT') */
  symbol?: string
  /** Exchange order ID */
  orderId?: string
  /** Distributed tracing correlation ID */
  traceId?: string
  /** Strategy that originated the request (e.g. 'SmaCross', 'GridBot-v3') */
  strategyId?: string
}

/** Convenience alias — InjectionContext is the Failure Context. */
export type FailureContext = InjectionContext

// ── Action ──

export type InjectionAction =
  | { type: 'latency'; duration: number }
  | { type: 'timeout' }
  | { type: 'disconnect' }
  | { type: 'reconnect'; delay: number }
  | { type: 'packet_loss' }
  | { type: 'partial_response'; size: number; raw?: unknown }
  | { type: 'malformed_response'; payload: string }
  | { type: 'connection_refused'; message?: string }
  | { type: 'rate_limit'; code: number; retryAfterMs: number }
  | { type: 'none' }

// ── Rule interface ──

export interface InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number

  /** Check whether this rule applies to the given context */
  matches(context: InjectionContext): boolean

  /** Produce the injection action (may use random state) */
  getAction(context: InjectionContext, random: RandomSource): InjectionAction

  /** Deep-clone the rule (for profile application) */
  clone(): InjectionRule
}

// ════════════════════════════════════════════
// Built-in rules
// ════════════════════════════════════════════

// ── LatencyRule ──

export interface LatencyRuleParams {
  minMs: number
  maxMs: number
}

export class LatencyRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly minMs: number
  private readonly maxMs: number

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params: LatencyRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.minMs = params.minMs
    this.maxMs = params.maxMs
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, random: RandomSource): InjectionAction {
    const duration = random.nextInt(this.minMs, this.maxMs)
    return { type: 'latency', duration }
  }

  clone(): LatencyRule {
    return new LatencyRule(this.id, this.scope, this.probability, { minMs: this.minMs, maxMs: this.maxMs })
  }
}

// ── TimeoutRule ──

export interface TimeoutRuleParams {
  durationMs: number
}

export class TimeoutRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly durationMs: number

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params: TimeoutRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.durationMs = params.durationMs
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, _random: RandomSource): InjectionAction {
    return { type: 'timeout' }
  }

  clone(): TimeoutRule {
    return new TimeoutRule(this.id, this.scope, this.probability, { durationMs: this.durationMs })
  }
}

// ── DisconnectRule ──

export interface DisconnectRuleParams {
  code?: number
  reason?: string
}

export class DisconnectRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly closeCode: number
  private readonly reason: string

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params?: DisconnectRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.closeCode = params?.code ?? 1006
    this.reason = params?.reason ?? 'Chaos: injected disconnect'
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, _random: RandomSource): InjectionAction {
    return { type: 'disconnect' }
  }

  clone(): DisconnectRule {
    return new DisconnectRule(this.id, this.scope, this.probability, {
      code: this.closeCode,
      reason: this.reason,
    })
  }
}

// ── ReconnectRule ──

export interface ReconnectRuleParams {
  delayMs: number
}

export class ReconnectRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly delayMs: number

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params: ReconnectRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.delayMs = params.delayMs
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, _random: RandomSource): InjectionAction {
    return { type: 'reconnect', delay: this.delayMs }
  }

  clone(): ReconnectRule {
    return new ReconnectRule(this.id, this.scope, this.probability, { delayMs: this.delayMs })
  }
}

// ── PacketLossRule ──

export interface PacketLossRuleParams {
  /** Additional probability filter on top of rule probability */
  lossRate: number
}

export class PacketLossRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly lossRate: number

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params: PacketLossRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.lossRate = params.lossRate
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(context: InjectionContext, random: RandomSource): InjectionAction {
    // Roll again against lossRate when the rule fires
    if (random.next() < this.lossRate) {
      return { type: 'packet_loss' }
    }
    return { type: 'none' }
  }

  clone(): PacketLossRule {
    return new PacketLossRule(this.id, this.scope, this.probability, { lossRate: this.lossRate })
  }
}

// ── PartialResponseRule ──

export interface PartialResponseRuleParams {
  /** Number of bytes/buffer fraction to keep before truncating */
  size: number
  raw?: unknown
}

export class PartialResponseRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly size: number
  private readonly raw: unknown

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params: PartialResponseRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.size = params.size
    this.raw = params.raw
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, _random: RandomSource): InjectionAction {
    return { type: 'partial_response', size: this.size, raw: this.raw }
  }

  clone(): PartialResponseRule {
    return new PartialResponseRule(this.id, this.scope, this.probability, { size: this.size, raw: this.raw })
  }
}

// ── MalformedResponseRule ──

export interface MalformedResponseRuleParams {
  payload?: string
}

export class MalformedResponseRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly payload: string

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params?: MalformedResponseRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.payload = params?.payload ?? 'not-json{{{'
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, _random: RandomSource): InjectionAction {
    return { type: 'malformed_response', payload: this.payload }
  }

  clone(): MalformedResponseRule {
    return new MalformedResponseRule(this.id, this.scope, this.probability, { payload: this.payload })
  }
}

// ── ConnectionRefusedRule ──

export interface ConnectionRefusedRuleParams {
  message?: string
}

export class ConnectionRefusedRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly message: string

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params?: ConnectionRefusedRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.message = params?.message ?? 'Chaos: connection refused'
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, _random: RandomSource): InjectionAction {
    return { type: 'connection_refused', message: this.message }
  }

  clone(): ConnectionRefusedRule {
    return new ConnectionRefusedRule(this.id, this.scope, this.probability, { message: this.message })
  }
}

// ── RateLimitRule ──

export interface RateLimitRuleParams {
  code?: number
  retryAfterMs?: number
}

export class RateLimitRule implements InjectionRule {
  readonly id: string
  readonly scope: FailureInjectionScope
  readonly probability: number
  private readonly code: number
  private readonly retryAfterMs: number

  constructor(
    id: string,
    scope: FailureInjectionScope,
    probability: number,
    params?: RateLimitRuleParams,
  ) {
    this.id = id
    this.scope = scope
    this.probability = probability
    this.code = params?.code ?? 429
    this.retryAfterMs = params?.retryAfterMs ?? 10_000
  }

  matches(_context: InjectionContext): boolean {
    return true
  }

  getAction(_context: InjectionContext, _random: RandomSource): InjectionAction {
    return { type: 'rate_limit', code: this.code, retryAfterMs: this.retryAfterMs }
  }

  clone(): RateLimitRule {
    return new RateLimitRule(this.id, this.scope, this.probability, {
      code: this.code,
      retryAfterMs: this.retryAfterMs,
    })
  }
}
