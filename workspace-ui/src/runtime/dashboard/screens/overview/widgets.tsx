import { WidgetRegistry } from '../../../WidgetRegistry'
import type { WidgetDefinition, WidgetProps } from '../../../types'
import type { FC } from 'react'

import { KpiStrip } from './widgets/KpiStrip'
import { MarketOverview } from './widgets/MarketOverview'
import { LiveSignals } from './widgets/LiveSignals'
import { PortfolioSnapshot } from './widgets/PortfolioSnapshot'
import { Opportunities } from './widgets/Opportunities'
import { StrategyStatus } from './widgets/StrategyStatus'
import { RuntimeHealth } from './widgets/RuntimeHealth'
import { Timeline } from './widgets/Timeline'
import { Notifications } from './widgets/Notifications'

/**
 * Register all Executive Overview widgets into WidgetRegistry.
 * Each widget definition maps to a DataProvider via its `id`.
 */
export function registerOverviewWidgets(): void {
  const widgets: { id: string; label: string; render: FC<WidgetProps> }[] = [
    { id: 'kpi-strip',        label: 'KPI Strip',        render: KpiStrip },
    { id: 'market-overview',  label: 'Market Overview',  render: MarketOverview },
    { id: 'live-signals',     label: 'Live Signals',     render: LiveSignals },
    { id: 'portfolio-snapshot', label: 'Portfolio',      render: PortfolioSnapshot },
    { id: 'opportunities',    label: 'Opportunities',    render: Opportunities },
    { id: 'strategy-status',  label: 'Strategies',       render: StrategyStatus },
    { id: 'runtime-health',   label: 'Runtime Health',   render: RuntimeHealth },
    { id: 'event-timeline',   label: 'Timeline',         render: Timeline },
    { id: 'notifications',    label: 'Notifications',    render: Notifications },
  ]

  for (const w of widgets) {
    const def: WidgetDefinition = {
      id: w.id,
      title: w.label,
      category: 'monitoring' as const,
      defaultSize: { cols: 1, rows: 1 },
      render: w.render as FC<WidgetProps>,
    }
    WidgetRegistry.register(def)
  }

  if (import.meta.env.DEV) {
    console.log(`[OverviewWidgets] Registered ${widgets.length} widgets`)
  }
}
