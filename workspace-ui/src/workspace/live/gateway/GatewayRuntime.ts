/**
 * GatewayRuntime.ts — Runtime that manages the active execution gateway
 *
 * The GatewayRuntime is the single point of contact for the rest of the
 * platform. It delegates all operations to the currently active ExecutionGateway.
 *
 * @since 4.1
 */

import type { ExecutionGateway, GatewayConfig, GatewayStatus } from './ExecutionGateway'
import type { ExecutionMode } from './ExecutionMode'
import { gatewayRegistry } from './GatewayRegistry'

export class GatewayRuntime {
  private gateway: ExecutionGateway | null = null
  private config: GatewayConfig | null = null
  private connected = false

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

  // ── Delegation ──

  /** Get the active gateway instance */
  getGateway(): ExecutionGateway {
    if (!this.gateway) {
      throw new Error('[GatewayRuntime] No active gateway. Call init() first.')
    }
    return this.gateway
  }

  // ── Singleton ──
}

/** Singleton */
export const gatewayRuntime = new GatewayRuntime()
