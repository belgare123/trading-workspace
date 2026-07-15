/**
 * Runtime API — Public Contract
 *
 * @since 2.0.0
 * @version 1.0.0
 *
 * Единая точка входа во все публичные Runtime API.
 * Изменение signalatur методов запрещено — только расширение через новые интерфейсы.
 *
 * Usage:
 *   import type { MarketApi } from '../../runtime/api';
 *   import { MARKET_API_VERSION } from '../../runtime/api';
 */

export type { MarketApi, OrderBook, OrderBookLevel, MarketTick, Candle } from './market'
export { MARKET_TOPICS, MARKET_API_VERSION } from './market'

export type { ReplayApi, ReplayState } from './replay'
export { REPLAY_TOPICS, REPLAY_API_VERSION } from './replay'

export type { StrategyApi, StrategyInfo, StrategyMetrics } from './strategy'
export { STRATEGY_TOPICS, STRATEGY_API_VERSION } from './strategy'

export type { PortfolioApi, Position, Balance } from './portfolio'
export { PORTFOLIO_TOPICS, PORTFOLIO_API_VERSION } from './portfolio'

export type { PluginApi, PluginInfo, PluginManifest } from './plugin'
export { PLUGIN_TOPICS, PLUGIN_API_VERSION } from './plugin'

export type { EventStoreApi, EventEntry, EventFilter } from './eventstore'
export { EVENTSTORE_TOPICS, EVENTSTORE_API_VERSION } from './eventstore'

export type { SearchApi, SearchResult, SearchItem } from './search'
export { SEARCH_TOPICS, SEARCH_API_VERSION } from './search'

export type { NotificationApi, NotificationEntry, NotificationLevel, EventSeverity } from './notification'
export { NOTIFICATION_TOPICS, NOTIFICATION_API_VERSION } from './notification'

export type { MLApi, MLModel } from './ml'
export { ML_TOPICS, ML_API_VERSION } from './ml'

// ── Service Map ──────────────────────────────────────────────────────
export interface RuntimeApiServices {
  market:       import('./market').MarketApi
  replay:       import('./replay').ReplayApi
  strategy:     import('./strategy').StrategyApi
  portfolio:    import('./portfolio').PortfolioApi
  plugin:       import('./plugin').PluginApi
  eventStore:   import('./eventstore').EventStoreApi
  search:       import('./search').SearchApi
  notification: import('./notification').NotificationApi
  ml:           import('./ml').MLApi
}

export type ServiceName = keyof RuntimeApiServices
export type ServiceInstance = RuntimeApiServices[ServiceName]

// ── Runtime Version ──────────────────────────────────────────────────
export const RUNTIME_API_VERSION = '2.0.0'
