/**
 * LiveProvider.ts — Live trading provider (orchestrator)
 *
 * LiveProvider is a pure coordinator. It:
 * - Delegates connection/session to BrokerSession → ConnectionAdapter
 * - Routes orders through OrderRouter → OrderAdapter
 * - Synchronizes positions via PositionSynchronizer → PositionAdapter
 * - Synchronizes account via AccountSynchronizer → AccountAdapter
 * - Converts broker events via BrokerEventAdapter
 * - Exposes capabilities via BrokerCapabilities
 *
 * LiveProvider does NOT:
 * - Calculate fees, PnL, or maintain a local ledger
 * - Know which exchange it's talking to
 * - Store API keys
 *
 * @since 4.5
 */

import type { BrokerAdapter } from './BrokerAdapter'
import type { BrokerCapabilities } from './BrokerCapabilities'
import type { LiveProviderConfig, ConnectionState } from './types'
import { ConnectionStates, DEFAULT_LIVE_CONFIG } from './types'
import { BrokerSession } from './BrokerSession'
import { BrokerClock } from './BrokerClock'
import { OrderRouter } from './OrderRouter'
import { PositionSynchronizer } from './PositionSynchronizer'
import { AccountSynchronizer } from './AccountSynchronizer'
import { BrokerEventAdapter } from './BrokerEventAdapter'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { Order } from '../../execution/types'
import { SecretsProvider, SecretKeys } from './SecretsProvider'
import type { RateLimiter } from './RateLimiter'
import type { RetryPolicy } from './RetryPolicy'

export class LiveProvider {
  public readonly id: string
  public readonly name: string
  public readonly capabilities: BrokerCapabilities
  public readonly session: BrokerSession
  public readonly router: OrderRouter
  public readonly positionSync: PositionSynchronizer
  public readonly accountSync: AccountSynchronizer
  public readonly eventAdapter: BrokerEventAdapter
  /** Exchange-aware clock synchronization (synced during BrokerSession.connect) */
  public readonly clock: BrokerClock
  /** Credential resolution (env vars, keychain, vault) */
  public readonly secrets: SecretsProvider

  private config: LiveProviderConfig
  private eventBus?: ExecutionEventBus

  constructor(
    adapter: BrokerAdapter,
    config: LiveProviderConfig,
    secrets?: SecretsProvider,
    rateLimiter?: RateLimiter,
    retryPolicy?: RetryPolicy,
  ) {
    this.id = adapter.id
    this.name = adapter.name
    this.capabilities = adapter.capabilities
    this.config = { ...DEFAULT_LIVE_CONFIG, ...config }

    // Sub-components
    this.secrets = secrets ?? new SecretsProvider()
    this.session = new BrokerSession(adapter, config)
    this.clock = this.session.clock
    this.router = new OrderRouter(adapter, rateLimiter, retryPolicy)
    this.positionSync = new PositionSynchronizer(adapter)
    this.accountSync = new AccountSynchronizer(adapter)
    this.eventAdapter = new BrokerEventAdapter(adapter)
  }

  // ── Connection ──

  async connect(apiKey?: string, apiSecret?: string): Promise<void> {
    // Resolve credentials: explicit args → config → SecretsProvider → error
    const key = apiKey ?? this.config.apiKey ?? await this.secrets.get(SecretKeys.apiKey(this.id)) ?? ''
    const secret = apiSecret ?? this.config.apiSecret ?? await this.secrets.get(SecretKeys.apiSecret(this.id)) ?? ''

    if (!key || !secret) {
      throw new Error(
        `LiveProvider(${this.id}): API key and secret are required. ` +
        `Set ${SecretKeys.apiKey(this.id)} and ${SecretKeys.apiSecret(this.id)} ` +
        'as env vars, pass them to connect(), or provide a SecretsProvider.',
      )
    }

    await this.session.connect(key, secret)
    this.afterConnect()
  }

  private afterConnect(): void {
    if (this.eventBus) {
      this.router.connectEventBus(this.eventBus)
      this.positionSync.connectEventBus(this.eventBus)
      this.accountSync.connectEventBus(this.eventBus)
      this.eventAdapter.connectEventBus(this.eventBus)
    }

    this.positionSync.start(this.config.positionSyncIntervalMs)
    this.accountSync.start(this.config.accountSyncIntervalMs)
  }

  async disconnect(): Promise<void> {
    this.positionSync.stop()
    this.accountSync.stop()
    await this.session.disconnect()
  }

  get connectionState(): ConnectionState {
    return this.session.state
  }

  // ── Event Bus ──

  connectEventBus(bus: ExecutionEventBus): void {
    this.eventBus = bus

    // If already connected, wire up sub-components immediately
    if (this.session.state === ConnectionStates.CONNECTED) {
      this.afterConnect()
    }
  }

  // ── Order Operations ──

  async placeOrder(order: Order): Promise<void> {
    await this.router.route(order)
  }

  async cancelOrder(clientOrderId: string): Promise<boolean> {
    return this.router.cancel(clientOrderId)
  }

  // ── Query ──

  get pendingOrderCount(): number {
    return this.router.pendingCount
  }

  // ── Cleanup ──

  async dispose(): Promise<void> {
    await this.disconnect()
    this.router.dispose()
    this.positionSync.dispose()
    this.accountSync.dispose()
    this.eventAdapter.dispose()
  }
}
