/**
 * RuntimeTelemetry.ts — Central SLI registry for all Runtimes
 *
 * The single entry point for all Runtime telemetry in the platform.
 * Each Runtime registers its SLI collectors here.
 *
 * Usage:
 *   runtimeTelemetry.gateway.requestLatency.record(45)
 *   runtimeTelemetry.gateway.reconnectCount.record(1)
 *   const snapshot = runtimeTelemetry.snapshot()
 *
 * @since 6.3.0
 */

import { SliCollector, type SliCollectorConfig } from './SliCollector'
import type { TelemetrySnapshot, SliRuntimeSnapshot, SliDescriptor } from './SliTypes'

/* ── SLI Descriptors ── */

const DESCRIPTORS = {
  gateway: {
    requestLatency: { name: 'gateway.request_latency', label: 'Gateway Request Latency', kind: 'latency' as const, unit: 'ms', domain: 'gateway' as const, description: 'End-to-end request latency through the gateway' },
    exchangeLatency: { name: 'gateway.exchange_latency', label: 'Exchange Response Latency', kind: 'latency' as const, unit: 'ms', domain: 'gateway' as const, description: 'Exchange response time for order operations' },
    queueDepth: { name: 'gateway.queue_depth', label: 'Gateway Queue Depth', kind: 'gauge' as const, unit: 'count', domain: 'gateway' as const, description: 'Current number of pending requests in gateway queue' },
    reconnectCount: { name: 'gateway.reconnect_count', label: 'Gateway Reconnects', kind: 'count' as const, unit: 'count', domain: 'gateway' as const, description: 'Number of reconnection attempts' },
    openRequests: { name: 'gateway.open_requests', label: 'Open Requests', kind: 'gauge' as const, unit: 'count', domain: 'gateway' as const, description: 'Currently in-flight gateway requests' },
    errorRate: { name: 'gateway.error_rate', label: 'Gateway Error Rate', kind: 'rate' as const, unit: 'req/s', domain: 'gateway' as const, description: 'Rate of failed gateway requests' },
  },
  trade: {
    entryLatency: { name: 'trade.entry_latency', label: 'Trade Entry Latency', kind: 'latency' as const, unit: 'ms', domain: 'trade' as const, description: 'Time from signal to entry fill' },
    exitLatency: { name: 'trade.exit_latency', label: 'Trade Exit Latency', kind: 'latency' as const, unit: 'ms', domain: 'trade' as const, description: 'Time from exit decision to fill' },
    activeTrades: { name: 'trade.active_trades', label: 'Active Trades', kind: 'gauge' as const, unit: 'count', domain: 'trade' as const, description: 'Currently active (non-terminal) trades' },
    recoveryDuration: { name: 'trade.recovery_duration', label: 'Recovery Duration', kind: 'latency' as const, unit: 'ms', domain: 'trade' as const, description: 'Time taken to recover trades on restart' },
    tradeThroughput: { name: 'trade.throughput', label: 'Trade Throughput', kind: 'rate' as const, unit: 'trades/min', domain: 'trade' as const, description: 'Trades processed per minute' },
  },
  wallet: {
    allocationLatency: { name: 'wallet.allocation_latency', label: 'Wallet Allocation Latency', kind: 'latency' as const, unit: 'ms', domain: 'wallet' as const, description: 'Time to allocate funds for a trade' },
    reserveLatency: { name: 'wallet.reserve_latency', label: 'Reserve Latency', kind: 'latency' as const, unit: 'ms', domain: 'wallet' as const, description: 'Time to reserve funds' },
    syncDuration: { name: 'wallet.sync_duration', label: 'Wallet Sync Duration', kind: 'latency' as const, unit: 'ms', domain: 'wallet' as const, description: 'Time to synchronize wallet with exchange' },
    freeBalance: { name: 'wallet.free_balance', label: 'Free Balance', kind: 'gauge' as const, unit: 'quote', domain: 'wallet' as const, description: 'Current free (unallocated) balance' },
  },
  risk: {
    validationLatency: { name: 'risk.validation_latency', label: 'Risk Validation Latency', kind: 'latency' as const, unit: 'ms', domain: 'risk' as const, description: 'Time to run risk rule evaluation' },
    rejectRate: { name: 'risk.reject_rate', label: 'Risk Reject Rate', kind: 'rate' as const, unit: 'req/s', domain: 'risk' as const, description: 'Rate of rejected order requests' },
    slowRules: { name: 'risk.slow_rules', label: 'Slow Risk Rules', kind: 'gauge' as const, unit: 'count', domain: 'risk' as const, description: 'Rules exceeding latency threshold' },
    evaluationsTotal: { name: 'risk.evaluations_total', label: 'Risk Evaluations', kind: 'count' as const, unit: 'count', domain: 'risk' as const, description: 'Total risk rule evaluations' },
  },
  strategy: {
    signalLatency: { name: 'strategy.signal_latency', label: 'Signal Generation Latency', kind: 'latency' as const, unit: 'ms', domain: 'strategy' as const, description: 'Time from bar to signal generation' },
    signalsPerSec: { name: 'strategy.signals_per_sec', label: 'Signals/sec', kind: 'rate' as const, unit: 'sig/s', domain: 'strategy' as const, description: 'Signal generation rate' },
    activeStrategies: { name: 'strategy.active_strategies', label: 'Active Strategies', kind: 'gauge' as const, unit: 'count', domain: 'strategy' as const, description: 'Currently running strategy instances' },
    signalsTotal: { name: 'strategy.signals_total', label: 'Total Signals', kind: 'count' as const, unit: 'count', domain: 'strategy' as const, description: 'Total signals generated since start' },
  },
} as const

/* ── Telemetry Groups ── */

export interface GatewayTelemetry {
  requestLatency: SliCollector
  exchangeLatency: SliCollector
  queueDepth: SliCollector
  reconnectCount: SliCollector
  openRequests: SliCollector
  errorRate: SliCollector
}

export interface TradeTelemetry {
  entryLatency: SliCollector
  exitLatency: SliCollector
  activeTrades: SliCollector
  recoveryDuration: SliCollector
  tradeThroughput: SliCollector
}

export interface WalletTelemetry {
  allocationLatency: SliCollector
  reserveLatency: SliCollector
  syncDuration: SliCollector
  freeBalance: SliCollector
}

export interface RiskTelemetry {
  validationLatency: SliCollector
  rejectRate: SliCollector
  slowRules: SliCollector
  evaluationsTotal: SliCollector
}

export interface StrategyTelemetry {
  signalLatency: SliCollector
  signalsPerSec: SliCollector
  activeStrategies: SliCollector
  signalsTotal: SliCollector
}

/* ── RuntimeTelemetry ── */

export class RuntimeTelemetry {
  readonly gateway: GatewayTelemetry
  readonly trade: TradeTelemetry
  readonly wallet: WalletTelemetry
  readonly risk: RiskTelemetry
  readonly strategy: StrategyTelemetry

  private readonly _startedAt = Date.now()

  private static _instance: RuntimeTelemetry | null = null

  constructor(config?: SliCollectorConfig) {
    this.gateway = {
      requestLatency: new SliCollector(DESCRIPTORS.gateway.requestLatency, config),
      exchangeLatency: new SliCollector(DESCRIPTORS.gateway.exchangeLatency, config),
      queueDepth: new SliCollector(DESCRIPTORS.gateway.queueDepth, config),
      reconnectCount: new SliCollector(DESCRIPTORS.gateway.reconnectCount, config),
      openRequests: new SliCollector(DESCRIPTORS.gateway.openRequests, config),
      errorRate: new SliCollector(DESCRIPTORS.gateway.errorRate, config),
    }
    this.trade = {
      entryLatency: new SliCollector(DESCRIPTORS.trade.entryLatency, config),
      exitLatency: new SliCollector(DESCRIPTORS.trade.exitLatency, config),
      activeTrades: new SliCollector(DESCRIPTORS.trade.activeTrades, config),
      recoveryDuration: new SliCollector(DESCRIPTORS.trade.recoveryDuration, config),
      tradeThroughput: new SliCollector(DESCRIPTORS.trade.tradeThroughput, config),
    }
    this.wallet = {
      allocationLatency: new SliCollector(DESCRIPTORS.wallet.allocationLatency, config),
      reserveLatency: new SliCollector(DESCRIPTORS.wallet.reserveLatency, config),
      syncDuration: new SliCollector(DESCRIPTORS.wallet.syncDuration, config),
      freeBalance: new SliCollector(DESCRIPTORS.wallet.freeBalance, config),
    }
    this.risk = {
      validationLatency: new SliCollector(DESCRIPTORS.risk.validationLatency, config),
      rejectRate: new SliCollector(DESCRIPTORS.risk.rejectRate, config),
      slowRules: new SliCollector(DESCRIPTORS.risk.slowRules, config),
      evaluationsTotal: new SliCollector(DESCRIPTORS.risk.evaluationsTotal, config),
    }
    this.strategy = {
      signalLatency: new SliCollector(DESCRIPTORS.strategy.signalLatency, config),
      signalsPerSec: new SliCollector(DESCRIPTORS.strategy.signalsPerSec, config),
      activeStrategies: new SliCollector(DESCRIPTORS.strategy.activeStrategies, config),
      signalsTotal: new SliCollector(DESCRIPTORS.strategy.signalsTotal, config),
    }
  }

  /* ── Snapshot ── */

  /** Full snapshot of all telemetry */
  snapshot(): TelemetrySnapshot {
    const toRuntimeSnap = (domain: string, metrics: Record<string, SliCollector>): SliRuntimeSnapshot => ({
      domain,
      metrics: Object.values(metrics).map(c => c.snapshot()),
      updatedAt: Date.now(),
    })

    return {
      runtimes: [
        toRuntimeSnap('gateway', this.gateway),
        toRuntimeSnap('trade', this.trade),
        toRuntimeSnap('wallet', this.wallet),
        toRuntimeSnap('risk', this.risk),
        toRuntimeSnap('strategy', this.strategy),
      ],
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this._startedAt) / 1000),
    }
  }

  /** Snapshot for a single domain */
  domainSnapshot(domain: string): SliRuntimeSnapshot | null {
    switch (domain) {
      case 'gateway': return { domain, metrics: Object.values(this.gateway).map(c => c.snapshot()), updatedAt: Date.now() }
      case 'trade': return { domain, metrics: Object.values(this.trade).map(c => c.snapshot()), updatedAt: Date.now() }
      case 'wallet': return { domain, metrics: Object.values(this.wallet).map(c => c.snapshot()), updatedAt: Date.now() }
      case 'risk': return { domain, metrics: Object.values(this.risk).map(c => c.snapshot()), updatedAt: Date.now() }
      case 'strategy': return { domain, metrics: Object.values(this.strategy).map(c => c.snapshot()), updatedAt: Date.now() }
      default: return null
    }
  }

  /** Reset all telemetry */
  resetAll(): void {
    for (const group of [this.gateway, this.trade, this.wallet, this.risk, this.strategy]) {
      for (const collector of Object.values(group)) {
        collector.reset()
      }
    }
  }

  /* ── Singleton ── */

  static get instance(): RuntimeTelemetry {
    if (!RuntimeTelemetry._instance) {
      RuntimeTelemetry._instance = new RuntimeTelemetry()
    }
    return RuntimeTelemetry._instance
  }

  static setInstance(instance: RuntimeTelemetry): void {
    RuntimeTelemetry._instance = instance
  }

  static resetInstance(): void {
    RuntimeTelemetry._instance = null
  }
}

/** Convenience singleton */
export const runtimeTelemetry: RuntimeTelemetry = new Proxy(
  {} as RuntimeTelemetry,
  {
    get(_target, prop: keyof RuntimeTelemetry) {
      return RuntimeTelemetry.instance[prop]
    },
  },
)
