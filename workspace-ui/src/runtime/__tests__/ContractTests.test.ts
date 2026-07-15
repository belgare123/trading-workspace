/**
 * Contract Tests — MockRuntime
 *
 * Прогоняет эталонную реализацию MockRuntime через
 * все контрактные тесты.
 *
 * Если MockRuntime проходит → контракты валидны.
 * Любая другая реализация (REST, WS, Sim, Cloud) должна
 * проходить те же тесты.
 */

import { describe } from 'vitest'
import { describeMarketContract } from '../contracts/MarketContract'
import { describeReplayContract } from '../contracts/ReplayContract'
import { describePluginContract } from '../contracts/PluginContract'
import {
  describePortfolioContract,
  describeStrategyContract,
  describeMLContract,
  describeSearchContract,
  describeEventStoreContract,
  describeNotificationContract,
} from '../contracts/ServiceContracts'
import {
  MockMarketRuntime,
  MockReplayRuntime,
  MockPluginRuntime,
  MockPortfolioRuntime,
  MockStrategyRuntime,
  MockMLRuntime,
  MockSearchRuntime,
  MockEventStoreRuntime,
  MockNotificationRuntime,
} from '../contracts/MockRuntime'

describe('Runtime Contract Tests — MockRuntime', () => {

  describeMarketContract('MarketRuntime', () => new MockMarketRuntime())
  describeReplayContract('ReplayRuntime', () => new MockReplayRuntime())
  describePluginContract('PluginRuntime', () => new MockPluginRuntime())
  describePortfolioContract('PortfolioRuntime', () => new MockPortfolioRuntime())
  describeStrategyContract('StrategyRuntime', () => new MockStrategyRuntime())
  describeMLContract('MLRuntime', () => new MockMLRuntime())
  describeSearchContract('SearchRuntime', () => new MockSearchRuntime())
  describeEventStoreContract('EventStoreRuntime', () => new MockEventStoreRuntime())
  describeNotificationContract('NotificationRuntime', () => new MockNotificationRuntime())
})
