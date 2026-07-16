/**
 * index.ts — Live Trading Platform barrel export
 *
 * @since 4.1
 */

// ── Gateway ──

export { ExecutionMode } from './gateway/ExecutionMode'
export type { ExecutionMode as ExecutionModeType } from './gateway/ExecutionMode'
export {
  EXECUTION_MODE_LABELS,
  EXECUTION_MODE_COLORS,
} from './gateway/ExecutionMode'

export type {
  ExecutionGateway,
  GatewayConfig,
  GatewayStatus,
  AccountInfo,
  OrderResult,
} from './gateway/ExecutionGateway'

export { GatewayRuntime, gatewayRuntime } from './gateway/GatewayRuntime'
export { gatewayRegistry } from './gateway/GatewayRegistry'
export type { GatewayFactory } from './gateway/GatewayRegistry'

// ── Providers ──

export { BacktestProvider } from './providers/BacktestProvider'
export { PaperProvider } from './providers/PaperProvider'

// ── Types ──

export type {
  MarketEventType,
  MarketEvent,
  TickerEvent,
  TradeEvent,
  KlineEvent,
  KlineInterval,
  OrderBookEvent,
  OrderBookLevel,
  MarketErrorEvent,
  LatencyEvent,
} from './types'

// ── Feed ──

export { LiveFeedRuntime } from './feed/LiveFeedRuntime'
export { MarketEventBus } from './feed/MarketEventBus'
export { SubscriptionManager } from './feed/SubscriptionManager'
export type { SubscriptionState } from './feed/SubscriptionManager'
export { FeedRegistry } from './feed/FeedRegistry'
export { SymbolRegistry } from './feed/SymbolRegistry'
export type { SymbolInfo } from './feed/SymbolRegistry'
export { FeedStatistics } from './feed/FeedStatistics'
export type { AdapterStats } from './feed/FeedStatistics'

// ── Adapters ──

export type { FeedAdapter, Listener } from './adapters/FeedAdapter'
export { MockFeedAdapter } from './adapters/MockFeedAdapter'
export { BinanceFeedAdapter } from './adapters/BinanceFeedAdapter'

// ── Cache ──

export { CandleCache } from './cache/CandleCache'
export { TradeCache } from './cache/TradeCache'
export { TickerCache } from './cache/TickerCache'
export { OrderBookCache, OrderBookSnapshot } from './cache/OrderBookCache'

// ── Aggregation ──

export { CandleAggregator } from './aggregation/CandleAggregator'
export { TimeframeBuilder } from './aggregation/TimeframeBuilder'
export { VolumeAggregator } from './aggregation/VolumeAggregator'
export type { VolumeStats } from './aggregation/VolumeAggregator'

// ── Journal ──

export { TradeJournal } from './journal/TradeJournal'
export type { JournalEntry, JournalEntryType } from './journal/TradeJournal'

// ── History & Audit (Sprint 4.4) ──

export type * from './history/types'
export { OrderHistoryStore } from './history/OrderHistoryStore'
export { PositionHistoryStore } from './history/PositionHistoryStore'
export { DecisionLog } from './history/DecisionLog'
export { StrategyHistoryStore } from './history/StrategyHistoryStore'
export { SessionHistoryStore } from './history/SessionHistoryStore'
export { TimelineBuilder } from './history/TimelineBuilder'
export { HistoryRuntime } from './history/HistoryRuntime'
export type { HistoryRuntimeOptions } from './history/HistoryRuntime'
export { JsonExporter } from './history/exporters/JsonExporter'
export type { HistoryExport } from './history/exporters/JsonExporter'
export { CsvExporter } from './history/exporters/CsvExporter'

// ── Live Provider — Types & Config (Sprint 4.5) ──

export type * from './live/types'
export {
  ConnectionStates,
  canTransition,
  DEFAULT_LIVE_CONFIG,
} from './live/types'
export type { LiveProviderConfig } from './live/types'

// ── Live Provider — Broker Adapter Contract (Sprint 4.6) ──

export type {
  BrokerAdapter,
  ConnectionAdapter,
  OrderAdapter,
  PositionAdapter,
  AccountAdapter,
  MarketDataAdapter,
} from './live/BrokerAdapter'

// ── Live Provider — Broker Capabilities ──

export type { BrokerCapabilities } from './live/BrokerCapabilities'
export {
  NO_CAPABILITIES,
  MOCK_CAPABILITIES,
  BINANCE_SPOT_CAPABILITIES,
  BINANCE_FUTURES_CAPABILITIES,
  BYBIT_CAPABILITIES,
} from './live/BrokerCapabilities'

// ── Live Provider — Broker Error Hierarchy (Sprint 4.6) ──

export {
  BrokerError,
  AuthenticationError,
  PermissionError,
  ValidationError,
  NetworkError,
  RateLimitError,
  ExchangeRejectedError,
  TemporaryUnavailableError,
  classifyBrokerError,
} from './live/BrokerError'

// ── Live Provider — Orchestration (Sprint 4.5) ──

export { BrokerSession } from './live/BrokerSession'
export type { SessionListener } from './live/BrokerSession'
export { OrderRouter } from './live/OrderRouter'
export { PositionSynchronizer } from './live/PositionSynchronizer'
export { AccountSynchronizer } from './live/AccountSynchronizer'
export { BrokerEventAdapter } from './live/BrokerEventAdapter'
export { LiveProvider } from './live/LiveProvider'

// ── Broker Implementations (Sprint 4.6) ──

export { MockBrokerAdapter, ReplayBrokerAdapter } from './brokers'
export type { MockBrokerConfig, ReplayEvent, ReplaySession, ReplayBrokerConfig } from './brokers'

// ── Execution Infrastructure Core (Sprint 4.6.1) ──

export { RetryPolicy } from './live/RetryPolicy'
export type { RetryPolicyConfig, RetryStrategy, RetryDecision } from './live/RetryPolicy'

export { BrokerClock } from './live/BrokerClock'
export type { BrokerClockConfig } from './live/BrokerClock'

export { RateLimiter, RateLimitExceeded } from './live/RateLimiter'
export type { RateLimitConfig, OperationType } from './live/RateLimiter'
