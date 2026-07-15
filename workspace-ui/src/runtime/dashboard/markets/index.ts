/**
 * Markets Module — dashboard-agnostic library of market widgets.
 *
 * Публичный API:
 *   import { registerMarkets } from './registerMarkets'
 *   registerMarkets()  // регистрирует всё в ядро
 *
 * @since 3.1.3
 */

export { registerMarkets, registerMarketsResources, registerMarketsPresentation } from './registerMarkets'
export { MarketsModule } from './MarketsModule'

export { MarketWatchlistWidget } from './widgets/MarketWatchlistWidget'
export { TradingChartWidget } from './widgets/TradingChartWidget'
export { OrderBookWidget } from './widgets/OrderBookWidget'
export { TimeAndSalesWidget } from './widgets/TimeAndSalesWidget'
export { MarketDepthWidget } from './widgets/MarketDepthWidget'
export { MarketHeatmapWidget } from './widgets/MarketHeatmapWidget'
export { ExchangeStatusWidget } from './widgets/ExchangeStatusWidget'
export { NewsFeedWidget } from './widgets/NewsFeedWidget'
export { ActiveAlertsWidget } from './widgets/ActiveAlertsWidget'

export type {
  WatchlistRow, MarketOrderBook, Trade, DepthPoint,
  HeatmapCell, NewsItem, Alert, ExchangeStatus,
} from './types'
