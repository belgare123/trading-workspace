// ── WorkspaceBuilder — fluent builder for TradingComposition ──
// Sprint 5.4 — Workspace Composition & Lifecycle
//
// Usage:
//   const ws = await new WorkspaceBuilder()
//     .withBroker(new BybitBrokerAdapter(...))
//     .withGateway(new BybitExecutionGateway(...))
//     .withStrategy(new Sma20Strategy())
//     .withRisk(BUILTIN_RISK_RULES)
//     .withConfig({ name: 'mainnet', mode: ExecutionMode.Live, symbols: ['BTCUSDT'] })
//     .build()
//   await ws.start()

import type { TradingConfig, RecoveryReport, WorkspaceHealth, RuntimeId } from './types'
import { LIFECYCLE_STATES } from './types'

import { LifecycleManager } from './LifecycleManager'
import { StartupRecoveryRuntime, type StartupRecoveryDeps } from './StartupRecoveryRuntime'

import type { BrokerAdapter } from '../live/live/BrokerAdapter'
import type { ExecutionGateway } from '../live/gateway/ExecutionGateway'
import { GatewayRuntime, type GatewayConfig } from '../live/gateway/GatewayRuntime'
import { ExecutionMode } from '../live/gateway/ExecutionMode'

import { RiskRuntime } from '../risk/runtime/RiskRuntime'
import type { RiskRuleDefinition } from '../risk/definition/RiskDefinition'
import type { RiskContextSource } from '../risk/runtime/RiskContext'

import type { StrategyDefinition } from '../strategy/definition'
import { StrategyRuntime, type ExecutionContext } from '../strategy/runtime/StrategyRuntime'
import { StrategyRegistry } from '../strategy/registry/StrategyRegistry'

import { TradeLifecycleRuntime, type TradeLifecycleOptions } from '../trade/runtime/TradeLifecycleRuntime'
import type { IOrderManager, IExitEngine, IRecoveryGateway, PositionSnapshot } from '../trade/runtime/interfaces'
import { Trade } from '../trade/Trade'

import { LiveFeedRuntime } from '../live/feed/LiveFeedRuntime'
import type { FeedAdapter } from '../live/adapters/FeedAdapter'

import { HistoryRuntime } from '../live/history/HistoryRuntime'

// ════════════════════════════════════════
// Workspace — facade over all runtimes
// ════════════════════════════════════════

export class Workspace {
  public readonly config: TradingConfig

  public readonly lifecycleManager: LifecycleManager
  public readonly startupRecovery: StartupRecoveryRuntime

  public readonly gateway: GatewayRuntime
  public readonly risk: RiskRuntime
  public readonly trade: TradeLifecycleRuntime
  public readonly orderManager: IOrderManager
  public readonly strategy: StrategyRuntime
  public readonly feed: LiveFeedRuntime
  public readonly history: HistoryRuntime
  /** Broker adapter instance used by this workspace (if available) */
  public readonly broker?: BrokerAdapter
  /** Underlying execution gateway (used for connection during start) */
  private readonly _executionGateway: ExecutionGateway

  constructor(opts: {
    config: TradingConfig
    lifecycleManager: LifecycleManager
    startupRecovery: StartupRecoveryRuntime
    gateway: GatewayRuntime
    risk: RiskRuntime
    trade: TradeLifecycleRuntime
    orderManager: IOrderManager
    strategy: StrategyRuntime
    feed: LiveFeedRuntime
    history: HistoryRuntime
    broker?: BrokerAdapter
    executionGateway: ExecutionGateway
  }) {
    this.config = opts.config
    this.lifecycleManager = opts.lifecycleManager
    this.startupRecovery = opts.startupRecovery
    this.gateway = opts.gateway
    this.risk = opts.risk
    this.trade = opts.trade
    this.orderManager = opts.orderManager
    this.strategy = opts.strategy
    this.feed = opts.feed
    this.history = opts.history
    this.broker = opts.broker
    this._executionGateway = opts.executionGateway
  }

  // ── Lifecycle ──

  /** Full startup: init → connect gateway → recover → run */
  async start(): Promise<RecoveryReport> {
    const lm = this.lifecycleManager
    lm.init()

    // Connect the gateway before recovery
    await this.gateway.use(this._executionGateway)

    lm.startRecovery()
    const report = await this.startupRecovery.recover()
    lm.completeRecovery(report)
    return report
  }

  /** Graceful shutdown */
  async stop(): Promise<void> {
    this.lifecycleManager.stop()
    await this.gateway.shutdown()
    this.orderManager.shutdown()
    this.lifecycleManager.finalize()
  }

  /**
   * Emergency stop — triggers Kill Switch, cancels orders, closes positions.
   */
  async emergencyStop(): Promise<void> {
    const lm = this.lifecycleManager

    // Block new trades via Kill Switch
    if ('trigger' in (this.risk as any)) {
      ;(this.risk as any).trigger?.({ reason: 'manual_emergency_stop' })
    }

    // Cancel all open orders
    const orders = await this.orderManager.getAll?.() ?? []
    for (const order of orders) {
      if (order.status === 'pending' || order.status === 'open') {
        await this.orderManager.cancel(order.id).catch(() => {})
      }
    }

    // Close open trades via KillSwitch if available
    const activeTrades = await this.trade.getActiveTrades()
    for (const trade of activeTrades) {
      await this.trade.close(trade.id, { reason: 'emergency_stop' }).catch(() => {})
    }

    // Shutdown lifecycle
    lm.stop()
    await this.gateway.shutdown()
    this.orderManager.shutdown()
    lm.finalize()
  }

  /**
   * Enter Safe Mode — block new trades, manage existing positions.
   */
  enterSafeMode(): void {
    this.lifecycleManager.enterSafeMode()
    if ('trigger' in (this.risk as any)) {
      ;(this.risk as any).trigger?.({ reason: 'safe_mode' })
    }
  }

  /**
   * Exit Safe Mode back to normal operation.
   */
  exitSafeMode(): void {
    this.lifecycleManager.exitSafeMode()
  }

  /** Current health snapshot */
  health(): WorkspaceHealth {
    const status = this.lifecycleManager.state
    const connected = this.gateway.isConnected()
    const running = status === LIFECYCLE_STATES.RUNNING

    const runtimes: Record<RuntimeId, 'running' | 'stopped' | 'error'> = {
      feed:       running ? 'running' : 'stopped',
      gateway:    connected ? 'running' : 'stopped',
      risk:       running ? 'running' : 'stopped',
      recovery:   running || status === LIFECYCLE_STATES.RECOVERING ? 'running' : 'stopped',
      strategy:   running ? 'running' : 'stopped',
      trade:      running ? 'running' : 'stopped',
      history:    running ? 'running' : 'stopped',
      killswitch: running ? 'running' : 'stopped',
    }

    return {
      status,
      uptimeMs: this.lifecycleManager.uptimeMs,
      gatewayConnected: connected,
      safeMode: status === LIFECYCLE_STATES.SAFE_MODE,
      runtimes,
      recoveryReport: this.lifecycleManager.lastRecoveryReport,
    }
  }
}

// ════════════════════════════════════════
// Build Output
// ════════════════════════════════════════

export interface BuiltComponents {
  workspace: Workspace
}

// ════════════════════════════════════════
// Default factory helpers
// ════════════════════════════════════════

/** Create the default set of runtime instances from config + components */
function createDefaultRuntimes(
  config: TradingConfig,
  gatewayInst: ExecutionGateway,
  adapter: BrokerAdapter | undefined,
  strategyDef: StrategyDefinition | undefined,
  riskRules: RiskRuleDefinition[] | undefined,
  feedAdapter: FeedAdapter | undefined,
): {
  gateway: GatewayRuntime
  risk: RiskRuntime
  feed: LiveFeedRuntime
  strategy: StrategyRuntime
  history: HistoryRuntime
  orderManager: IOrderManager
  exitEngine: IExitEngine
  trade: TradeLifecycleRuntime
} {
  // ── Feed ──
  const feed = new LiveFeedRuntime()
  if (feedAdapter) {
    feed.useAdapter(feedAdapter as any)
  }

  // ── GatewayRuntime ──
  const gateway = new GatewayRuntime()
  const gwConfig: Partial<GatewayConfig> = config.testnet
    ? { credentials: { testnet: 'true' } }
    : {}
  // Lazy init — user must call Workspace.start() which connects the gateway

  // ── RiskRuntime ──
  // Use gateway instance as RiskContextSource if it implements it
  const source: RiskContextSource = (gatewayInst as any).getPositions
    ? (gatewayInst as unknown as RiskContextSource)
    : { getPositions: () => new Map(), getAccount: () => undefined, getMarket: () => undefined }

  const risk = new RiskRuntime(source, config.mode as any)
  if (riskRules) {
    risk.registry.registerAll(riskRules)
  }

  // ── Wire Risk → Gateway ──
  gateway.useRiskRuntime(risk)

  // ── StrategyRuntime ──
  const strategy = new StrategyRuntime({} as unknown as ExecutionContext)
  if (strategyDef) {
    // Register in the singleton registry so StrategyRuntime.add can resolve it
    StrategyRegistry.register(strategyDef)
    strategy.add(strategyDef.id, strategyDef.name, config.symbols[0] ?? 'BTCUSDT', '1h')
  }

  // ── HistoryRuntime ──
  const history = new HistoryRuntime()

  // ── OrderManager ──
  // For the builder, create a minimal OrderManager wrapping the gateway
  // The real OrderManager construction is complex; keep it simple here
  const orderManager: IOrderManager = {
    create: async (req) => {
      const result = await gatewayInst.placeOrder({
        id: req.clientOrderId ?? `ord_${req.tradeId}_${Date.now()}`,
        symbol: req.symbol,
        side: req.side === 'buy' ? 'buy' : 'sell',
        type: req.type as any,
        quantity: req.quantity,
        price: req.price,
        stopPrice: req.stopPrice,
        reduceOnly: req.reduceOnly ?? false,
        timeInForce: req.timeInForce ?? 'gtc',
        strategyId: 'default',
        clientOrderId: req.clientOrderId,
      } as any)
      return {
        id: result.orderId,
        tradeId: req.tradeId,
        symbol: req.symbol,
        side: req.side === 'buy' ? 'buy' as const : 'sell' as const,
        type: req.type as any,
        quantity: req.quantity,
        price: req.price ?? null,
        status: result.accepted ? 'new' : 'rejected',
        reduceOnly: req.reduceOnly ?? false,
        timeInForce: req.timeInForce ?? 'gtc',
        createdTime: Date.now(),
        updatedTime: Date.now(),
      } as any
    },
    cancel: async (orderId) => { await gatewayInst.cancelOrder(orderId) },
    replace: async (orderId, req) => {
      const result = await gatewayInst.replaceOrder(orderId, req as any)
      return { id: result.orderId } as any
    },
    amend: async (orderId, req) => {
      const result = await gatewayInst.replaceOrder(orderId, req as any)
      return { id: result.orderId } as any
    },
    get: (orderId) => undefined,
    list: () => [],
    recover: async () => {},
    shutdown: () => {},
    on: () => () => {},
    off: () => {},
  }

  // ── ExitEngine (thin for Sprint 5.4) ──
  const exitEngine: IExitEngine = {
    evaluate: () => null,
  }

  // ── TradeLifecycleRuntime ──
  const trade = new TradeLifecycleRuntime({
    orderManager,
    exitEngine,
  })

  return {
    gateway,
    risk,
    feed,
    strategy,
    history,
    orderManager,
    exitEngine,
    trade,
  }
}

// ════════════════════════════════════════
// WorkspaceBuilder
// ════════════════════════════════════════

export class WorkspaceBuilder {
  private _config?: Partial<TradingConfig>
  private _brokerAdapter?: BrokerAdapter
  private _executionGateway?: ExecutionGateway
  private _strategyDef?: StrategyDefinition
  private _riskRules?: RiskRuleDefinition[]
  private _feedAdapter?: FeedAdapter

  // ── Fluent API ──

  withConfig(config: Partial<TradingConfig>): this {
    this._config = { ...this._config, ...config }
    return this
  }

  withBroker(adapter: BrokerAdapter): this {
    this._brokerAdapter = adapter
    return this
  }

  withGateway(gateway: ExecutionGateway): this {
    this._executionGateway = gateway
    return this
  }

  withStrategy(def: StrategyDefinition): this {
    this._strategyDef = def
    return this
  }

  withRisk(rules: RiskRuleDefinition[]): this {
    this._riskRules = rules
    return this
  }

  withFeed(adapter: FeedAdapter): this {
    this._feedAdapter = adapter
    return this
  }

  // ── Build ──

  build(): Workspace {
    const config = this.resolveConfig()
    const gatewayInst = this.requireGateway()
    const adapter = this._brokerAdapter

    const runtimes = createDefaultRuntimes(
      config,
      gatewayInst,
      adapter,
      this._strategyDef,
      this._riskRules,
      this._feedAdapter,
    )

    // ── StartupRecoveryRuntime ──
    const deps: StartupRecoveryDeps = {
      gateway: runtimes.gateway,
      risk: runtimes.risk,
      recoverTrades: async () => {
        // Attempt to recover trades from existing positions
        try {
          const positions = await runtimes.gateway.getPositions()
          const warnings: string[] = []
          const errors: string[] = []

          for (const pos of positions) {
            try {
              // Create a synthetic trade for each open position
              // (In a full Setup this would go through RecoveryController)
              const trade = Trade.create({
                strategyId: 'recovery',
                symbol: pos.symbol,
                direction: (pos as any).direction ?? (pos.size >= 0 ? 'long' : 'short'),
                entryPrice: (pos as any).entryPrice ?? 0,
                quantity: Math.abs(pos.size),
              })
              runtimes.trade['registerTrade']?.(trade)
            } catch (e) {
              errors.push(`Trade recovery failed for ${pos.symbol}: ${(e as Error).message}`)
            }
          }

          return { recovered: positions.length, warnings, errors }
        } catch {
          return { recovered: 0, warnings: ['Could not fetch positions for trade recovery'], errors: [] }
        }
      },
      syncHistory: async () => {
        try {
          runtimes.history.bindExecutionEventBus?.({} as any)
          return { warnings: [], errors: [] }
        } catch (e) {
          return { warnings: [`History sync: ${(e as Error).message}`], errors: [] }
        }
      },
    }

    const startupRecovery = new StartupRecoveryRuntime(deps)
    const lifecycleManager = new LifecycleManager()

    return new Workspace({
      config,
      lifecycleManager,
      startupRecovery,
      gateway: runtimes.gateway,
      risk: runtimes.risk,
      trade: runtimes.trade,
      orderManager: runtimes.orderManager,
      strategy: runtimes.strategy,
      feed: runtimes.feed,
      history: runtimes.history,
      broker: adapter,
      executionGateway: gatewayInst,
    })
  }

  private resolveConfig(): TradingConfig {
    const cfg = this._config ?? {}
    return {
      name: cfg.name ?? 'workspace',
      mode: cfg.mode ?? 'live' as any,
      broker: cfg.broker ?? 'bybit',
      symbols: cfg.symbols ?? ['BTCUSDT'],
      ...cfg,
    }
  }

  private requireGateway(): ExecutionGateway {
    if (this._executionGateway) return this._executionGateway
    throw new Error(
      '[WorkspaceBuilder] No gateway provided. Call .withGateway(new BybitExecutionGateway(...)) or similar.',
    )
  }
}

// ════════════════════════════════════════
// WorkspaceFactory — one-shot convenience
// ════════════════════════════════════════

export const WorkspaceFactory = {
  /**
   * Build and start in one call.
   * Bootstrap scripts (20-30 lines) use this.
   */
  async create(config: Partial<TradingConfig> & {
    gateway?: ExecutionGateway
    riskRules?: RiskRuleDefinition[]
  }): Promise<Workspace> {
    if (!config.gateway) {
      throw new Error('[WorkspaceFactory] gateway instance required')
    }
    const builder = new WorkspaceBuilder()
    builder.withConfig(config).withGateway(config.gateway)
    if (config.riskRules) builder.withRisk(config.riskRules)

    const workspace = builder.build()
    await workspace.start()
    return workspace
  },
}
