
import { WidgetRegistry } from './WidgetRegistry';
import type { WidgetDefinition, WidgetProps } from './types';
import {
  MetricStrip,
  LiveSignalsWidget,
  EventFlowWidget,
  PortfolioWidget,
  PnLWidget,
  StrategyWidget,
  HealthWidget,
  TimelineWidget,
  ReplayWidget,
  OpportunitiesWidget,
  WorkspaceStatusWidget,
} from '../pages/dashboard/widgets';

function wrap(Widget: (props: Record<string, unknown>) => React.ReactElement | null) {
  return (_props: WidgetProps) => <Widget />;
}

export const defaultWidgets: WidgetDefinition[] = [
  {
    id: 'metrics',
    title: 'KPI Metrics',
    description: 'System-wide key performance indicators',
    category: 'system',
    defaultSize: { cols: 6, rows: 1 },
    render: wrap(MetricStrip),
  },
  {
    id: 'signals',
    title: 'Live Signals',
    description: 'Real-time trading signals with confidence',
    category: 'analysis',
    defaultSize: { cols: 1, rows: 3 },
    render: wrap(LiveSignalsWidget),
  },
  {
    id: 'event-flow',
    title: 'Event Flow',
    description: 'Pipeline visualization: Market → Portfolio',
    category: 'monitoring',
    defaultSize: { cols: 1, rows: 3 },
    render: wrap(EventFlowWidget),
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    description: 'Current positions and balances',
    category: 'trading',
    defaultSize: { cols: 1, rows: 2 },
    render: wrap(PortfolioWidget),
  },
  {
    id: 'pnl',
    title: 'PnL 24h',
    description: 'Profit and loss overview with sparkline',
    category: 'analysis',
    defaultSize: { cols: 1, rows: 1 },
    render: wrap(PnLWidget),
  },
  {
    id: 'strategies',
    title: 'Strategies',
    description: 'Strategy performance cards',
    category: 'trading',
    defaultSize: { cols: 1, rows: 2 },
    render: wrap(StrategyWidget),
  },
  {
    id: 'health',
    title: 'System Health',
    description: 'Gauge + service status bars',
    category: 'system',
    defaultSize: { cols: 1, rows: 1 },
    render: wrap(HealthWidget),
  },
  {
    id: 'timeline',
    title: 'Timeline',
    description: 'Recent events feed',
    category: 'monitoring',
    defaultSize: { cols: 1, rows: 2 },
    render: wrap(TimelineWidget),
  },
  {
    id: 'replay',
    title: 'Replay Engine',
    description: 'Historical data replay controls',
    category: 'system',
    defaultSize: { cols: 2, rows: 1 },
    render: wrap(ReplayWidget),
  },
  {
    id: 'opportunities',
    title: 'Opportunities',
    description: 'Active opportunity distribution',
    category: 'analysis',
    defaultSize: { cols: 1, rows: 1 },
    render: wrap(OpportunitiesWidget),
  },
  {
    id: 'workspace-status',
    title: 'Workspace Status',
    description: 'Service availability status',
    category: 'system',
    defaultSize: { cols: 3, rows: 1 },
    render: wrap(WorkspaceStatusWidget),
  },
];

export function registerDefaultWidgets(): void {
  for (const def of defaultWidgets) {
    WidgetRegistry.register(def);
  }
}
