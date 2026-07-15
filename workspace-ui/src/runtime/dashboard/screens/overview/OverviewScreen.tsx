import { DataProviderRegistry } from '../../data/DataProviderRegistry'
import { kpiProvider } from '../../data/providers/KpiProvider'
import { marketOverviewProvider } from '../../data/providers/MarketOverviewProvider'
import { liveSignalsProvider } from '../../data/providers/LiveSignalsProvider'
import { portfolioSnapshotProvider } from '../../data/providers/PortfolioSnapshotProvider'
import { opportunitiesProvider } from '../../data/providers/OpportunitiesProvider'
import { strategyStatusProvider } from '../../data/providers/StrategyStatusProvider'
import { runtimeHealthProvider } from '../../data/providers/RuntimeHealthProvider'
import { timelineProvider } from '../../data/providers/TimelineProvider'
import { notificationsProvider } from '../../data/providers/NotificationsProvider'
import { registerOverviewWidgets } from './widgets'
import { PresetRegistry } from '../../presets/PresetRegistry'

/**
 * Bootstrap Executive Overview screen.
 * Registers DataProviders + Widgets + Preset in one call.
 */
export function setupOverviewScreen(): void {
  // 1. Register DataProviders
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

  // 2. Register widget components
  registerOverviewWidgets()

  // 3. Register the Executive Overview preset
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

  if (import.meta.env.DEV) {
    console.log('[OverviewScreen] Executive Overview ready')
  }
}
