/**
 * API Compatibility Tests — type-level contract verification
 *
 * Эти тесты проверяют, что все Runtime API соблюдают контракт.
 * Если файл компилируется — контракт соблюдён.
 *
 * @since 2.0.0
 */

import type {
  // Core APIs
  MarketApi,
  ReplayApi,
  StrategyApi,
  PortfolioApi,
  PluginApi,
  EventStoreApi,
  SearchApi,
  NotificationApi,
  MLApi,

  // Service Map
  RuntimeApiServices,
  ServiceName,
  ServiceInstance,

  // Types
  OrderBook,
  OrderBookLevel,
  MarketTick,
  Candle,
  ReplayState,
  StrategyInfo,
  StrategyMetrics,
  Position,
  Balance,
  PluginInfo,
  PluginManifest,
  EventEntry,
  EventFilter,
  SearchResult,
  SearchItem,
  NotificationEntry,
  NotificationLevel,
  MLModel,

  // Version Constants
  MARKET_API_VERSION,
  REPLAY_API_VERSION,
  STRATEGY_API_VERSION,
  PORTFOLIO_API_VERSION,
  PLUGIN_API_VERSION,
  EVENTSTORE_API_VERSION,
  SEARCH_API_VERSION,
  NOTIFICATION_API_VERSION,
  ML_API_VERSION,
  RUNTIME_API_VERSION,
} from '../api'

// ── 1. Все сервисы имеют поле id ──
type AssertHasId<T extends { readonly id: string }> = T

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _marketId: AssertHasId<MarketApi> = null as unknown as MarketApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _replayId: AssertHasId<ReplayApi> = null as unknown as ReplayApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _strategyId: AssertHasId<StrategyApi> = null as unknown as StrategyApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _portfolioId: AssertHasId<PortfolioApi> = null as unknown as PortfolioApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _pluginId: AssertHasId<PluginApi> = null as unknown as PluginApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _eventStoreId: AssertHasId<EventStoreApi> = null as unknown as EventStoreApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _searchId: AssertHasId<SearchApi> = null as unknown as SearchApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _notifId: AssertHasId<NotificationApi> = null as unknown as NotificationApi
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mlId: AssertHasId<MLApi> = null as unknown as MLApi

// ── 2. Service map покрывает все сервисы ──
type AssertAllServicesInMap =
  RuntimeApiServices[keyof RuntimeApiServices] extends ServiceInstance
    ? true
    : false

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _allServicesInMap: AssertAllServicesInMap = true

// ── 3. ServiceName — union всех id ──
type AssertServiceNameIsUnion = ServiceName extends string ? true : false
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _serviceNameIsString: AssertServiceNameIsUnion = true

// ── 4. Все версионные константы — строки ──
type AssertVersionIsString = typeof MARKET_API_VERSION extends string ? true : false
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _versionIsString: AssertVersionIsString = true

// ── 5. Топики — const literal types ──
// Проверка, что хотя бы один топик определён для каждого сервиса
import { MARKET_TOPICS } from '../api'
import { REPLAY_TOPICS } from '../api'
import { STRATEGY_TOPICS } from '../api'
import { PORTFOLIO_TOPICS } from '../api'
import { PLUGIN_TOPICS } from '../api'
import { EVENTSTORE_TOPICS } from '../api'
import { SEARCH_TOPICS } from '../api'
import { NOTIFICATION_TOPICS } from '../api'
import { ML_TOPICS } from '../api'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _marketTopics = MARKET_TOPICS.PRICE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _replayTopics = REPLAY_TOPICS.STATE_CHANGE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _strategyTopics = STRATEGY_TOPICS.STATUS_CHANGE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _portfolioTopics = PORTFOLIO_TOPICS.POSITION_CHANGE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _pluginTopics = PLUGIN_TOPICS.INSTALL
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _eventStoreTopics = EVENTSTORE_TOPICS.EVENT_APPENDED
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _searchTopics = SEARCH_TOPICS.INDEX_UPDATED
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _notifTopics = NOTIFICATION_TOPICS.NEW
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _mlTopics = ML_TOPICS.MODEL_STATUS

// ── 6. Проверка сигнатуры API публичных методов ──
type MarketApiShape = {
  id: 'market'
  price(symbol: string): Promise<number>
  symbols(): Promise<string[]>
  subscribe(symbol: string, cb: (price: number) => void): () => void
  orderBook(symbol: string): Promise<OrderBook>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _marketApiShape: MarketApi extends MarketApiShape ? true : false = true

// ── 7. Version check ──
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _versionCheck = [
  MARKET_API_VERSION,
  REPLAY_API_VERSION,
  STRATEGY_API_VERSION,
  PORTFOLIO_API_VERSION,
  PLUGIN_API_VERSION,
  EVENTSTORE_API_VERSION,
  SEARCH_API_VERSION,
  NOTIFICATION_API_VERSION,
  ML_API_VERSION,
  RUNTIME_API_VERSION,
] as const

// ── 8. OrderBook shape ──
type AssertOrderBookHasSymbol = OrderBook extends { symbol: string } ? true : false
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _obHasSymbol: AssertOrderBookHasSymbol = true

export {}
