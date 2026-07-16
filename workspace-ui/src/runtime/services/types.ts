/**
 * Runtime Service Types
 *
 * @deprecated Import from '../../runtime/api' instead.
 * This file exists for backward compatibility during migration.
 * Все интерфейсы заморожены в runtime/api/.
 */

export type {
  MarketApi,
  ReplayApi,
  PluginApi,
  PortfolioApi,
  StrategyApi,
  MLApi,
  NotificationApi,
  SearchApi,
  EventStoreApi,
} from '../api'

export type { Position, Balance } from '../api'
export type { StrategyInfo, StrategyMetrics } from '../api'
export type { MLModel } from '../api'
export type { NotificationEntry, NotificationLevel } from '../api'
export type { SearchResult, SearchItem } from '../api'
export type { EventEntry, EventFilter } from '../api'

// ── Service types re-exported as their original names ──
export type MarketRuntime  = import('../api').MarketApi
export type ReplayRuntime  = import('../api').ReplayApi
export type PluginRuntime  = import('../api').PluginApi
export type PortfolioRuntime = import('../api').PortfolioApi
export type StrategyRuntime  = import('../api').StrategyApi
export type MLRuntime        = import('../api').MLApi
export type NotificationRuntime = import('../api').NotificationApi
export type SearchRuntime    = import('../api').SearchApi
export type EventStoreRuntime = import('../api').EventStoreApi

// ── Service Map ──
export interface RuntimeServices {
  market:       MarketRuntime
  replay:       ReplayRuntime
  plugin:       PluginRuntime
  portfolio:    PortfolioRuntime
  strategy:     StrategyRuntime
  ml:           MLRuntime
  notification: NotificationRuntime
  search:       SearchRuntime
  eventStore:   EventStoreRuntime
}

export type ServiceName = keyof RuntimeServices
export type ServiceInstance = RuntimeServices[ServiceName]
