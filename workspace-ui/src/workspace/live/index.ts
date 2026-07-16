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
export { LiveProvider } from './providers/LiveProvider'

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

// ── History & Audit ──

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
