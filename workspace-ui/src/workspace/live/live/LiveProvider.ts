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
import { OrderRouter } from './OrderRouter'
import { PositionSynchronizer } from './PositionSynchronizer'
import { AccountSynchronizer } from './AccountSynchronizer'
import { BrokerEventAdapter } from './BrokerEventAdapter'
import type { ExecutionEventBus } from '../../execution/events/ExecutionEventBus'
import type { Order } from '../../execution/types'

export class LiveProvider {
  public readonly id: string
  public readonly name: string
  public readonly capabilities: BrokerCapabilities
  public readonly session: BrokerSession
  public readonly router: OrderRouter
  public readonly positionSync: PositionSynchronizer
  public readonly accountSync: AccountSynchronizer
  public readonly eventAdapter: BrokerEventAdapter

  private config: LiveProviderConfig
  private eventBus?: ExecutionEventBus

  constructor(adapter: BrokerAdapter, config: LiveProviderConfig) {
    this.id = adapter.id
    this.name = adapter.name
    this.capabilities = adapter.capabilities
    this.config = { ...DEFAULT_LIVE_CONFIG, ...config }

    // Sub-components
    this.session = new BrokerSession(adapter, config)
    this.router = new OrderRouter(adapter)
    this.positionSync = new PositionSynchronizer(adapter)
    this.accountSync = new AccountSynchronizer(adapter)
    this.eventAdapter = new BrokerEventAdapter(adapter)
  }

  // ── Connection ──

  async connect(apiKey?: string, apiSecret?: string): Promise<void> {
    const key = apiKey ?? this.config.apiKey ?? ''
    const secret = apiSecret ?? this.config.apiSecret ?? ''

    if (!key || !secret) {
      throw new Error('LiveProvider: API key and secret are required')
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
