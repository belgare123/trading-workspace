/**
 * registerMarkets — единая публичная точка входа Markets Widget Library.
 *
 * Регистрирует в замороженное ядро:
 *   - 9 виджетов → WidgetRegistry
 *   - 9 DataProvider'ов → DataProviderRegistry
 *   - 1 пресет → PresetRegistry
 *   - 1 экран → ScreenRegistry
 *
 * Разделено на registerMarketsResources() + registerMarketsPresentation()
 * для использования через MarketsModule (ClientModule contract).
 *
 * Никаких изменений DashboardRuntime, DashboardShell, ScreenRenderer.
 *
 * @since 3.1.3
 */

import { WidgetRegistry } from '../../WidgetRegistry'
import { DataProviderRegistry } from '../data/DataProviderRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'
import { ScreenRegistry, type ScreenEntry } from '../screen/ScreenRegistry'
import type { WidgetDefinition, WidgetProps } from '../../types'
import type { FC } from 'react'
import { BarChart3 } from 'lucide-react'
import type { DashboardPreset } from '../presets/types'

// ── Widgets ──
import {
  MarketWatchlistWidget, TradingChartWidget, OrderBookWidget,
  TimeAndSalesWidget, MarketDepthWidget, MarketHeatmapWidget,
  ExchangeStatusWidget, NewsFeedWidget, ActiveAlertsWidget,
} from './widgets'

// ── Providers ──
import {
  marketWatchlistProvider, orderBookProvider,
  timeAndSalesProvider, marketDepthProvider,
  marketHeatmapProvider, exchangeStatusProvider,
  newsFeedProvider, activeAlertsProvider,
  tradingChartProvider,
} from './providers/MarketDataProviders'

// ── Resources (providers + widgets) ──

export function registerMarketsResources(): void {
  // 1. DataProviders
  const providers = [
    marketWatchlistProvider, orderBookProvider,
    timeAndSalesProvider, marketDepthProvider,
    marketHeatmapProvider, exchangeStatusProvider,
    newsFeedProvider, activeAlertsProvider,
    tradingChartProvider,
  ]
  for (const p of providers) DataProviderRegistry.register(p)

  // 2. Widgets
  const widgetDefs: { id: string; label: string; category: WidgetDefinition['category']; render: FC<WidgetProps> }[] = [
    { id: 'market-watchlist',  label: 'Market Watchlist',  category: 'monitoring', render: MarketWatchlistWidget as FC<WidgetProps> },
    { id: 'trading-chart',     label: 'Trading Chart',     category: 'analysis',   render: TradingChartWidget as FC<WidgetProps> },
    { id: 'order-book',        label: 'Order Book',        category: 'trading',    render: OrderBookWidget as FC<WidgetProps> },
    { id: 'time-sales',        label: 'Time & Sales',      category: 'trading',    render: TimeAndSalesWidget as FC<WidgetProps> },
    { id: 'market-depth',      label: 'Market Depth',      category: 'trading',    render: MarketDepthWidget as FC<WidgetProps> },
    { id: 'market-heatmap',    label: 'Market Heatmap',    category: 'analysis',   render: MarketHeatmapWidget as FC<WidgetProps> },
    { id: 'exchange-status',   label: 'Exchange Status',   category: 'monitoring', render: ExchangeStatusWidget as FC<WidgetProps> },
    { id: 'news-feed',         label: 'News Feed',         category: 'monitoring', render: NewsFeedWidget as FC<WidgetProps> },
    { id: 'active-alerts',     label: 'Active Alerts',     category: 'monitoring', render: ActiveAlertsWidget as FC<WidgetProps> },
  ]
  for (const w of widgetDefs) {
    WidgetRegistry.register({
      id: w.id,
      title: w.label,
      category: w.category,
      defaultSize: { cols: 1, rows: 1 },
      render: w.render,
    })
  }
}

// ── Presentation (preset + screen) ──

export function registerMarketsPresentation(): void {
  // 3. Markets preset
  const preset: DashboardPreset = {
    id: 'markets',
    title: 'Markets',
    description: 'Market surveillance: charts, depth, trades, liquidations, alerts, news',
    screens: [
      {
        id: 'markets',
        title: 'Markets',
        layout: '3-column',
        widgets: [
          'market-watchlist',
          'trading-chart',
          'order-book',
          'time-sales',
          'market-depth',
          'market-heatmap',
          'exchange-status',
          'news-feed',
          'active-alerts',
        ],
      },
    ],
  }
  PresetRegistry.register(preset)

  // 4. Markets screen
  const screen: ScreenEntry = {
    id: 'markets',
    title: 'Markets',
    preset: 'markets',
    icon: BarChart3,
    category: 'workspace',
    order: 20,
  }
  ScreenRegistry.register(screen)
}

// ── Combined convenience (backward compat) ──

export function registerMarkets(): void {
  registerMarketsResources()
  registerMarketsPresentation()

  if (import.meta.env.DEV) {
    console.log(`[Markets] Registered 9 widgets, 9 providers, 1 preset, 1 screen`)
  }
}
