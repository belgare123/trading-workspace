/**
 * GatewayRegistry.ts — Registry for execution providers
 *
 * Providers are registered by mode and resolved at runtime.
 * This allows swapping execution mode without changing strategy code.
 *
 * @since 4.1
 */

import type { ExecutionGateway } from './ExecutionGateway'
import type { ExecutionMode } from './ExecutionMode'

// ── Gateway Provider Factory ──

export interface GatewayFactory {
  readonly mode: ExecutionMode
  create(): ExecutionGateway
}

// ── Registry ──

class GatewayRegistryImpl {
  private readonly factories = new Map<ExecutionMode, GatewayFactory>()
  private instance: ExecutionGateway | null = null

  /**
   * Register a gateway factory for an execution mode.
   */
  register(factory: GatewayFactory): void {
    if (this.factories.has(factory.mode)) {
      console.warn(`[GatewayRegistry] Overwriting factory for mode: ${factory.mode}`)
    }
    this.factories.set(factory.mode, factory)
  }

  /**
   * Unregister a gateway factory.
   */
  unregister(mode: ExecutionMode): void {
    this.factories.delete(mode)
  }

  /**
   * Check if a mode has a registered factory.
   */
  has(mode: ExecutionMode): boolean {
    return this.factories.has(mode)
  }

  /**
   * List all registered modes.
   */
  listModes(): ExecutionMode[] {
    return Array.from(this.factories.keys())
  }

  /**
   * Create a gateway for the given mode.
   * Throws if no factory is registered.
   */
  create(mode: ExecutionMode): ExecutionGateway {
    const factory = this.factories.get(mode)
    if (!factory) {
      throw new Error(`[GatewayRegistry] No factory registered for mode: ${mode}`)
    }
    return factory.create()
  }

  /**
   * Get or create the singleton gateway instance.
   * Once created, the same instance is reused until cleared.
   */
  getOrCreate(mode: ExecutionMode): ExecutionGateway {
    if (!this.instance || this.instance.mode !== mode) {
      this.instance = this.create(mode)
    }
    return this.instance
  }

  /**
   * Clear the cached instance.
   */
  clear(): void {
    this.instance = null
  }
}

/** Singleton */
export const gatewayRegistry = new GatewayRegistryImpl()
