/**
 * Dashboard presets — column/row span configuration for each widget layout.
 * Pattern: widget id → { colSpan, rowSpan }
 * Supports multiple presets: default, compact, signals-focus, monitoring
 */

export type WidgetPreset = Record<string, { colSpan: number; rowSpan: number }>;

export interface DashboardPreset {
  name: string;
  label: string;
  columns: string;
  autoRows?: string;
  widgets: WidgetPreset;
}

export const presets: DashboardPreset[] = [
  {
    name: 'default',
    label: 'Overview',
    columns: '320px 1fr 420px',
    autoRows: '180px',
    widgets: {
      metricStrip: { colSpan: 3, rowSpan: 1 },
      liveSignals: { colSpan: 1, rowSpan: 3 },
      eventFlow: { colSpan: 1, rowSpan: 3 },
      portfolio: { colSpan: 1, rowSpan: 2 },
      strategy: { colSpan: 1, rowSpan: 2 },
      timeline: { colSpan: 1, rowSpan: 2 },
      health: { colSpan: 1, rowSpan: 1 },
      replay: { colSpan: 2, rowSpan: 1 },
      opportunities: { colSpan: 1, rowSpan: 1 },
      workspaceStatus: { colSpan: 3, rowSpan: 1 },
    },
  },
  {
    name: 'signals-focus',
    label: 'Signals Focus',
    columns: '1fr 360px',
    autoRows: '200px',
    widgets: {
      metricStrip: { colSpan: 2, rowSpan: 1 },
      liveSignals: { colSpan: 1, rowSpan: 4 },
      eventFlow: { colSpan: 1, rowSpan: 2 },
      portfolio: { colSpan: 1, rowSpan: 1 },
      strategy: { colSpan: 1, rowSpan: 1 },
      timeline: { colSpan: 1, rowSpan: 1 },
      health: { colSpan: 1, rowSpan: 1 },
      workspaceStatus: { colSpan: 2, rowSpan: 1 },
    },
  },
  {
    name: 'monitoring',
    label: 'Monitoring',
    columns: '1fr 1fr 1fr',
    autoRows: '160px',
    widgets: {
      metricStrip: { colSpan: 3, rowSpan: 1 },
      health: { colSpan: 1, rowSpan: 2 },
      timeline: { colSpan: 1, rowSpan: 2 },
      workspaceStatus: { colSpan: 1, rowSpan: 2 },
      replay: { colSpan: 3, rowSpan: 1 },
      eventFlow: { colSpan: 3, rowSpan: 2 },
    },
  },
  {
    name: 'trading',
    label: 'Trading',
    columns: '1fr 340px',
    autoRows: '200px',
    widgets: {
      metricStrip: { colSpan: 2, rowSpan: 1 },
      chart: { colSpan: 1, rowSpan: 4 },
      orderbook: { colSpan: 1, rowSpan: 4 },
      liveSignals: { colSpan: 1, rowSpan: 2 },
      pnl: { colSpan: 1, rowSpan: 1 },
      workspaceStatus: { colSpan: 2, rowSpan: 1 },
    },
  },
  {
    name: 'research',
    label: 'Research',
    columns: '1fr 1fr 1fr',
    autoRows: '180px',
    widgets: {
      metricStrip: { colSpan: 3, rowSpan: 1 },
      strategy: { colSpan: 1, rowSpan: 2 },
      eventFlow: { colSpan: 1, rowSpan: 2 },
      timeline: { colSpan: 1, rowSpan: 2 },
      opportunities: { colSpan: 1, rowSpan: 1 },
      liveSignals: { colSpan: 1, rowSpan: 1 },
      replay: { colSpan: 1, rowSpan: 1 },
      workspaceStatus: { colSpan: 3, rowSpan: 1 },
    },
  },
];

export function getPreset(name: string): DashboardPreset {
  return presets.find(p => p.name === name) ?? presets[0];
}
