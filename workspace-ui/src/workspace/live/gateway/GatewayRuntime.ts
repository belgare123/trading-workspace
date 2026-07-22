/**
 * GatewayRuntime.ts — Runtime that manages the active execution gateway
 *
 * The GatewayRuntime is the single point of contact for the rest of the
 * platform. It delegates all operations to the currently active ExecutionGateway
 * and applies risk checks via RiskRuntime before order placement.
 *
 * Flow:
 *   placeOrder(order)
 *     → riskRuntime.sendOrder(order)  [pre-trade risk check]
 *       → if 'reject': return rejection
 *       → if 'allow' | 'modify': delegate to executionGateway.placeOrder(order)
 *
 * @since 4.1
 */

import type { ExecutionGateway, GatewayConfig, GatewayStatus, OrderResult } from './ExecutionGateway'
import type { ExecutionMode } from './ExecutionMode'
import { gatewayRegistry } from './GatewayRegistry'
import type { OrderRequest, Order, Position } from '../../execution/types'
import type { RiskRuntime } from '../../risk/runtime/RiskRuntime'
import { runtimeTelemetry } from '../sli/RuntimeTelemetry'
import {
  GatewayState,
  deriveState,
  isTransitionAllowed,
  type TransportHealth,
  createGatewayHealthCheck,
  describeDegradation,
} from './GatewayState'
import type { HealthAggregator } from '../../runtime/observability/HealthAggregator'

export class GatewayRuntime {
  private gateway: ExecutionGateway | null = null
  private config: GatewayConfig | null = null
  private connected = false
  private startTime = 0

  // ── Transport State Machine ──

  private _transportHealth: TransportHealth = {
    restOnline: false,
    publicWsOnline: false,
    privateWsOnline: false,
  }
  private _state: GatewayState = GatewayState.Disconnected
  private _lastState: GatewayState = GatewayState.Disconnected
  private _stateChangeCount = 0

  // ── State Machine API ──

  /** Get current gateway state */
  getState(): GatewayState {
    return this._state
  }

  /** Get current transport health */
  getTransportHealth(): TransportHealth {
    return { ...this._transportHealth }
  }

  /** Get number of state changes since init */
  getStateChangeCount(): number {
    return this._stateChangeCount
  }

  /**
   * Update transport health and derive new state.
   * Respects transition rules — throws on forbidden transition.
   */
  updateTransportHealth(health: Partial<TransportHealth>): void {
    const updated: TransportHealth = {
      ...this._transportHealth,
      ...health,
    }
    const newState = deriveState(updated)
    if (!isTransitionAllowed(this._state, newState)) {
      throw new Error(
        `[GatewayRuntime] Forbidden transition: ${this._state} → ${newState} ` +
        `(trigger: ${describeDegradation(updated)}). ` +
        `Use updateTransportHealth() with intermediate states.`,
      )
    }
    this._transportHealth = updated
    this._applyStateTransition()
  }

  /** Register health check with HealthAggregator */
  registerHealthCheck(healthAggregator: HealthAggregator): void {
    healthAggregator.register('gateway', createGatewayHealthCheck(
      () => this._state,
      () => this._transportHealth,
    ))
  }

  // ── Private: State Transition ──

  private _applyStateTransition(): void {
    const prev = this._state
    this._state = deriveState(this._transportHealth)

    if (prev !== this._state) {
      this._stateChangeCount++
      runtimeTelemetry.gateway.reconnectCount.record(this._stateChangeCount)
    }

    this.connected = this._state !== GatewayState.Disconnected
  }

  /** Optional risk runtime for pre-trade checks */
  public riskRuntime: RiskRuntime | null = null

  // ── Lifecycle ──

  /**
   * Initialize the gateway runtime with the given mode.
   * Registers default providers if not already registered.
   */
  async init(mode: ExecutionMode, config?: Partial<GatewayConfig>): Promise<void> {
    if (!gatewayRegistry.has(mode)) {
      throw new Error(`[GatewayRuntime] No provider registered for mode: ${mode}`)
    }

    this.gateway = gatewayRegistry.create(mode)
    this.config = {
      mode,
      ...config,
    }

    await this.gateway.connect(this.config)
    this.connected = true
    this.startTime = Date.now()
    runtimeTelemetry.gateway.reconnectCount.reset()
    runtimeTelemetry.gateway.openRequests.set(0)
    runtimeTelemetry.gateway.errorRate.reset()

    // Set transport health after successful connect
    this._transportHealth = {
      restOnline: true,
      publicWsOnline: true,
      privateWsOnline: true,
    }
    this._applyStateTransition()
  }

  /**
   * Set risk runtime for pre-trade checks.
   */
  useRiskRuntime(runtime: RiskRuntime): void {
    this.riskRuntime = runtime
  }

  /**
   * Connect using an existing ExecutionGateway instance (bypasses registry).
   * Used when the gateway is created externally (e.g., via WorkspaceBuilder.withGateway()).
   */
  async use(gateway: ExecutionGateway): Promise<void> {
    this.gateway = gateway
    this.config = {
      mode: gateway.mode,
      ...(this.config ?? {}),
    }
    await this.gateway.connect(this.config)
    this.connected = true
    this.startTime = Date.now()

    // Set transport health after use()
    this._transportHealth = {
      restOnline: true,
      publicWsOnline: true,
      privateWsOnline: true,
    }
    this._applyStateTransition()
  }

  /**
   * Shutdown the active gateway.
   */
  async shutdown(): Promise<void> {
    if (this.gateway && this.connected) {
      await this.gateway.disconnect()
    }
    this.gateway = null
    this.connected = false
    this._transportHealth = {
      restOnline: false,
      publicWsOnline: false,
      privateWsOnline: false,
    }
    this._applyStateTransition()
  }

  /**
   * Check if the gateway is connected.
   */
  isConnected(): boolean {
    return this.connected && this.gateway !== null
  }

  /**
   * Get the current gateway status.
   */
  getStatus(): GatewayStatus | null {
    if (!this.gateway) return null
    return this.gateway.getStatus()
  }

  /** Get the active gateway instance */
  getGateway(): ExecutionGateway {
    if (!this.gateway) {
      throw new Error('[GatewayRuntime] No active gateway. Call init() first.')
    }
    return this.gateway
  }

  // ── Orders (with risk check) ──

  /**
   * Place an order through the gateway.
   * If RiskRuntime is attached, runs pre-trade risk evaluation first.
   */
  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const gateway = this.getGateway()

    runtimeTelemetry.gateway.openRequests.inc()

    const start = Date.now()
    try {
      // Pre-trade risk check
      if (this.riskRuntime) {
        const decision = await this.riskRuntime.sendOrder(request)
        if (decision.status === 'reject') {
          runtimeTelemetry.gateway.openRequests.dec()
          runtimeTelemetry.gateway.errorRate.record(1)
          return {
            accepted: false,
            orderId: request.id,
            message: `Risk rejected: ${decision.violations.map((v) => v.message).join('; ')}`,
          }
        }
        // Use modified order if risk returned one
        if (decision.order) {
          request = decision.order
        }
      }

      const result = await gateway.placeOrder(request)
      const latency = Date.now() - start
      runtimeTelemetry.gateway.requestLatency.record(latency)
      runtimeTelemetry.gateway.openRequests.dec()
      return result
    } catch (err) {
      runtimeTelemetry.gateway.openRequests.dec()
      runtimeTelemetry.gateway.errorRate.record(1)
      throw err
    }
  }

  /**
   * Cancel a specific order by ID.
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    return this.getGateway().cancelOrder(orderId)
  }

  /**
   * Cancel all open orders, optionally for a specific symbol.
   */
  async cancelAllOrders(symbol?: string): Promise<number> {
    const gateway = this.getGateway()
    if (typeof (gateway as any).cancelAllOrders === 'function') {
      return (gateway as any).cancelAllOrders(symbol)
    }
    // Fallback: cancel one by one
    const orders = await gateway.getOrders({ symbol, status: 'open' })
    let count = 0
    for (const order of orders) {
      if (await gateway.cancelOrder(order.id)) count++
    }
    return count
  }

  // ── Queries ──

  /**
   * Get all orders (optionally filtered).
   */
  async getOrders(filter?: { symbol?: string; status?: string; limit?: number }): Promise<Order[]> {
    return this.getGateway().getOrders(filter)
  }

  /**
   * Get all positions.
   */
  async getPositions(): Promise<Position[]> {
    return this.getGateway().getPositions()
  }

  /**
   * Get position for a specific symbol.
   */
  async getPosition(symbol: string): Promise<Position | null> {
    return this.getGateway().getPosition(symbol)
  }
}

/** Singleton */
export const gatewayRuntime = new GatewayRuntime()
