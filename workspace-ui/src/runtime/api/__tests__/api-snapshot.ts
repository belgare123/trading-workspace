/**
 * Public API Report — auto-generated snapshot
 *
 * @since 2.0.0
 * @description JSON-манифест всех публичных экспортов Runtime API.
 * Используется для автоматического отслеживания изменений контракта.
 *
 * Регенерация:
 *   npx ts-node src/runtime/api/__tests__/api-snapshot.ts
 */

import {
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
  MARKET_TOPICS,
  REPLAY_TOPICS,
  STRATEGY_TOPICS,
  PORTFOLIO_TOPICS,
  PLUGIN_TOPICS,
  EVENTSTORE_TOPICS,
  SEARCH_TOPICS,
  NOTIFICATION_TOPICS,
  ML_TOPICS,
} from '../api'

export interface ApiSnapshotEntry {
  name: string
  version: string
  exports: string[]
  topics: string[]
}

const snapshot: ApiSnapshotEntry[] = [
  {
    name: 'market',
    version: MARKET_API_VERSION,
    exports: [
      'MarketApi',
      'OrderBook',
      'OrderBookLevel',
      'MarketTick',
      'Candle',
      'MARKET_TOPICS',
      'MARKET_API_VERSION',
    ],
    topics: Object.values(MARKET_TOPICS),
  },
  {
    name: 'replay',
    version: REPLAY_API_VERSION,
    exports: [
      'ReplayApi',
      'ReplayState',
      'REPLAY_TOPICS',
      'REPLAY_API_VERSION',
    ],
    topics: Object.values(REPLAY_TOPICS),
  },
  {
    name: 'strategy',
    version: STRATEGY_API_VERSION,
    exports: [
      'StrategyApi',
      'StrategyInfo',
      'StrategyMetrics',
      'STRATEGY_TOPICS',
      'STRATEGY_API_VERSION',
    ],
    topics: Object.values(STRATEGY_TOPICS),
  },
  {
    name: 'portfolio',
    version: PORTFOLIO_API_VERSION,
    exports: [
      'PortfolioApi',
      'Position',
      'Balance',
      'PORTFOLIO_TOPICS',
      'PORTFOLIO_API_VERSION',
    ],
    topics: Object.values(PORTFOLIO_TOPICS),
  },
  {
    name: 'plugin',
    version: PLUGIN_API_VERSION,
    exports: [
      'PluginApi',
      'PluginInfo',
      'PluginManifest',
      'PLUGIN_TOPICS',
      'PLUGIN_API_VERSION',
    ],
    topics: Object.values(PLUGIN_TOPICS),
  },
  {
    name: 'eventstore',
    version: EVENTSTORE_API_VERSION,
    exports: [
      'EventStoreApi',
      'EventEntry',
      'EventFilter',
      'EVENTSTORE_TOPICS',
      'EVENTSTORE_API_VERSION',
    ],
    topics: Object.values(EVENTSTORE_TOPICS),
  },
  {
    name: 'search',
    version: SEARCH_API_VERSION,
    exports: [
      'SearchApi',
      'SearchResult',
      'SearchItem',
      'SEARCH_TOPICS',
      'SEARCH_API_VERSION',
    ],
    topics: Object.values(SEARCH_TOPICS),
  },
  {
    name: 'notification',
    version: NOTIFICATION_API_VERSION,
    exports: [
      'NotificationApi',
      'NotificationEntry',
      'NotificationLevel',
      'NOTIFICATION_TOPICS',
      'NOTIFICATION_API_VERSION',
    ],
    topics: Object.values(NOTIFICATION_TOPICS),
  },
  {
    name: 'ml',
    version: ML_API_VERSION,
    exports: [
      'MLApi',
      'MLModel',
      'ML_TOPICS',
      'ML_API_VERSION',
    ],
    topics: Object.values(ML_TOPICS),
  },
  {
    name: 'runtime',
    version: RUNTIME_API_VERSION,
    exports: [
      'RuntimeApiServices',
      'ServiceName',
      'ServiceInstance',
      'RUNTIME_API_VERSION',
    ],
    topics: [],
  },
]

// Generate JSON report
const report = JSON.stringify(snapshot, null, 2)

// In Node: fs.writeFileSync('api-snapshot.json', report)
// For browser: console output
if (typeof process !== 'undefined' && process?.stdout) {
  console.log(report)
}

export { snapshot }
