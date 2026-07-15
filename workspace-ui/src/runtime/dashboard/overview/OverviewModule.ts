/**
 * OverviewModule — Executive Overview dashboard screen.
 *
 * Registers:
 *   - 9 DataProviders (KPI, MarketOverview, LiveSignals, …)
 *   - 9 Overview widgets (KpiStrip, MarketOverview, LiveSignals, …)
 *   - Executive Overview preset + screen
 *
 * Depends on: workspace-foundation (generic widgets, commands, search)
 *
 * @since 3.1.3.5
 */

import type { ClientModule, RuntimeContext } from '../../modules/types'
import { DataProviderRegistry } from '../data/DataProviderRegistry'
import { ScreenRegistry } from '../screen/ScreenRegistry'
import { PresetRegistry } from '../presets/PresetRegistry'

import { kpiProvider } from '../data/providers/KpiProvider'
import { marketOverviewProvider } from '../data/providers/MarketOverviewProvider'
import { liveSignalsProvider } from '../data/providers/LiveSignalsProvider'
import { portfolioSnapshotProvider } from '../data/providers/PortfolioSnapshotProvider'
import { opportunitiesProvider } from '../data/providers/OpportunitiesProvider'
import { strategyStatusProvider } from '../data/providers/StrategyStatusProvider'
import { runtimeHealthProvider } from '../data/providers/RuntimeHealthProvider'
import { timelineProvider } from '../data/providers/TimelineProvider'
import { notificationsProvider } from '../data/providers/NotificationsProvider'

import { registerOverviewWidgets } from '../screens/overview/widgets'
import { LayoutDashboard } from 'lucide-react'

export const OverviewModule: ClientModule = {
  id: 'overview',
  name: 'Executive Overview',
  version: '3.1.3',
  description: 'Real-time trading dashboard with KPIs, market data, signals, and system health',
  dependsOn: ['workspace-foundation'],

  registerResources(_context: RuntimeContext): void {
    // 1. DataProviders
    const providers = [
      kpiProvider,
      marketOverviewProvider,
      liveSignalsProvider,
      portfolioSnapshotProvider,
      opportunitiesProvider,
      strategyStatusProvider,
      runtimeHealthProvider,
      timelineProvider,
      notificationsProvider,
    ]
    for (const p of providers) {
      DataProviderRegistry.register(p)
    }

    // 2. Overview widgets
    registerOverviewWidgets()

    if (import.meta.env.DEV) {
      console.log('[overview] Registered ' + providers.length + ' providers')
    }
  },

  registerPresentation(_context: RuntimeContext): void {
    // 3. Register Executive Overview preset
    PresetRegistry.register({
      id: 'executive-overview',
      title: 'Executive Overview',
      description: 'Real-time trading dashboard with KPIs, market data, signals, and system health',
      screens: [
        {
          id: 'overview',
          title: 'Overview',
          layout: '3-column',
          widgets: [
            'kpi-strip',
            'market-overview',
            'live-signals',
            'portfolio-snapshot',
            'opportunities',
            'strategy-status',
            'runtime-health',
            'event-timeline',
            'notifications',
          ],
        },
      ],
    })

    // 4. Register overview screen
    ScreenRegistry.register({
      id: 'overview',
      title: 'Executive Overview',
      preset: 'executive-overview',
      icon: LayoutDashboard,
      category: 'workspace',
      order: 10,
    })

    if (import.meta.env.DEV) {
      console.log('[overview] Registered 1 preset + 1 screen')
    }
  },
}
