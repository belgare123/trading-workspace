/**
 * Markets Preset — композиция 9 рыночных виджетов.
 *
 * Регистрирует:
 *   1. Screen (навигация)
 *   2. Preset (компоновка виджетов)
 *
 * @since 3.1.3
 */

import { BarChart3 } from 'lucide-react'
import { ScreenRegistry } from '../../screen/ScreenRegistry'
import { PresetRegistry } from '../../presets/PresetRegistry'

export function registerMarketsPreset(): void {
  // ── Screen ──
  ScreenRegistry.register({
    id: 'markets',
    title: 'Markets',
    icon: BarChart3,
    category: 'markets',
    order: 2,
    preset: 'markets',
  })

  // ── Preset ──
  PresetRegistry.register({
    id: 'markets',
    title: 'Markets',
    description: 'Real-time market data: watchlist, order book, trades, heatmap and more',
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
  })
}
