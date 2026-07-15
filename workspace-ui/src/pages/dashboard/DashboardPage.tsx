import { ChartWidget } from './widgets/ChartWidget';
import { OrderBookWidget } from './widgets/OrderBookWidget';
import { Activity, BarChart3, CandlestickChart, Calendar, Database, Edit3, Gauge, Layers, Play, Radio, RefreshCw, Share2, TrendingUp, Zap } from 'lucide-react';
import { WidgetGrid, WidgetCell } from './DashboardGrid';
import { WidgetHeader } from './widgets/_shared';
import { MetricStrip } from './widgets/MetricStrip';
import { LiveSignalsWidget } from './widgets/LiveSignalsWidget';
import { EventFlowWidget } from './widgets/EventFlowWidget';
import { PortfolioWidget } from './widgets/PortfolioWidget';
import { PnLWidget } from './widgets/PnLWidget';
import { StrategyWidget } from './widgets/StrategyWidget';
import { HealthWidget } from './widgets/HealthWidget';
import { TimelineWidget } from './widgets/TimelineWidget';
import { ReplayWidget } from './widgets/ReplayWidget';
import { OpportunitiesWidget } from './widgets/OpportunitiesWidget';
import { WorkspaceStatusWidget } from './widgets/WorkspaceStatusWidget';
import { DashboardPresetSwitcher } from '../../components/DashboardPresetSwitcher';
import { type DashboardPreset, getPreset } from './presets';
import { useStore } from '../../store';
import { useCallback, useEffect, useRef } from 'react';

interface DashboardPageProps {
  preset?: string;
}

// Map of preset widget keys to stable widget IDs for drag-and-drop identity
const WIDGET_IDS: Record<string, string> = {
  metricStrip: 'metricStrip',
  liveSignals: 'liveSignals',
  eventFlow: 'eventFlow',
  portfolio: 'portfolio',
  strategy: 'strategy',
  timeline: 'timeline',
  health: 'health',
  replay: 'replay',
  opportunities: 'opportunities',
  pnl: 'pnl',
  chart: 'chart',
  orderbook: 'orderbook',
  workspaceStatus: 'workspaceStatus',
};

const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? 'Good morning' : HOUR < 17 ? 'Good afternoon' : 'Good evening';

export function DashboardPage({ preset = 'default' }: DashboardPageProps) {
  const config: DashboardPreset = getPreset(preset);
  const w = config.widgets;
  const widgetLayouts = useStore((s) => s.widgetGridLayouts);
  const setWidgetLayout = useStore((s) => s.setWidgetLayout);
  const swapWidgetLayouts = useStore((s) => s.swapWidgetLayouts);

  const gridRef = useRef<HTMLDivElement>(null);

  // Listen for widget:swap custom events from WidgetCell drag-and-drop
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { from: string; to: string };
      if (detail?.from && detail?.to) {
        swapWidgetLayouts(detail.from, detail.to);
      }
    };
    el.addEventListener('widget:swap', handler);
    return () => el.removeEventListener('widget:swap', handler);
  }, [swapWidgetLayouts]);

  const getLayout = useCallback(
    (key: string, defaultCol: number, defaultRow: number) => {
      const custom = widgetLayouts[key];
      return custom ? { colSpan: custom.colSpan, rowSpan: custom.rowSpan } : { colSpan: defaultCol, rowSpan: defaultRow };
    },
    [widgetLayouts],
  );

  const panel = 'tw-card p-4 overflow-auto transition-all duration-200';

  return (
    <div ref={gridRef} className="h-full overflow-auto" style={{ background: 'var(--bg)' }}>
      {/* ── TraderWaves-style Header ── */}
      <div style={{
        padding: '20px 24px 0',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        {/* Left: greeting + sync status */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {GREETING}, Trader
            </h1>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(34,197,94,0.1)',
              color: '#22c55e',
              fontWeight: 500,
            }}>
              TEST
            </span>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(59,130,246,0.1)',
              color: 'var(--primary)',
              fontWeight: 500,
            }}>
              Free
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Last sync · Just now
          </p>
        </div>

        {/* Right: date range */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          <Calendar size={14} style={{ color: 'var(--primary)' }} />
          <span>May 1 – Jul 15, 2026</span>
        </div>
      </div>

      {/* ── Sub-navigation bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 0,
      }}>
        <button className="btn-primary btn-sm">Account</button>
        <button className="btn-ghost btn-sm">All Accounts</button>
        <span style={{ flex: 1 }} />
        <button className="btn-ghost btn-sm" title="Share">
          <Share2 size={14} /> Share
        </button>
        <button className="btn-ghost btn-sm" title="Edit dashboard">
          <Edit3 size={14} /> Edit
        </button>
        <button className="btn-ghost btn-sm" title="Calendar view">
          <Calendar size={14} />
        </button>
        <button className="btn btn-sm" style={{ color: 'var(--primary)', borderColor: 'rgba(59,130,246,0.2)' }}>
          + New Template
        </button>
      </div>

      {/* ── Preset Switcher ── */}
      <div style={{ padding: '12px 24px 0' }}>
        <DashboardPresetSwitcher />
      </div>

      {/* ── KPI Cards ── */}
      {w.metricStrip && <MetricStrip />}

      {/* ── Widget Grid ── */}
      <WidgetGrid
        columns={config.columns}
        autoRows={config.autoRows}
        gap={4}
        style={{ padding: '0 24px 24px' }}
      >
        {/* Live Signals */}
        {w.liveSignals && (
          <WidgetCell index={1} widgetId={WIDGET_IDS.liveSignals} colSpan={getLayout('liveSignals', w.liveSignals.colSpan, w.liveSignals.rowSpan).colSpan} rowSpan={getLayout('liveSignals', w.liveSignals.colSpan, w.liveSignals.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('liveSignals', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Live Signals" subtitle="5 active" icon={<Radio size={16} />} />
              <LiveSignalsWidget />
            </div>
          </WidgetCell>
        )}

        {/* Event Flow */}
        {w.eventFlow && (
          <WidgetCell index={2} widgetId={WIDGET_IDS.eventFlow} colSpan={getLayout('eventFlow', w.eventFlow.colSpan, w.eventFlow.rowSpan).colSpan} rowSpan={getLayout('eventFlow', w.eventFlow.colSpan, w.eventFlow.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('eventFlow', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Event Flow" subtitle="Pipeline" icon={<Layers size={16} />} />
              <EventFlowWidget />
            </div>
          </WidgetCell>
        )}

        {/* Portfolio */}
        {w.portfolio && (
          <WidgetCell index={3} widgetId={WIDGET_IDS.portfolio} colSpan={getLayout('portfolio', w.portfolio.colSpan, w.portfolio.rowSpan).colSpan} rowSpan={getLayout('portfolio', w.portfolio.colSpan, w.portfolio.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('portfolio', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Portfolio" subtitle="4 assets" icon={<Database size={16} />} />
              <PortfolioWidget />
            </div>
          </WidgetCell>
        )}

        {/* Strategy Performance */}
        {w.strategy && (
          <WidgetCell index={4} widgetId={WIDGET_IDS.strategy} colSpan={getLayout('strategy', w.strategy.colSpan, w.strategy.rowSpan).colSpan} rowSpan={getLayout('strategy', w.strategy.colSpan, w.strategy.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('strategy', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Strategies" subtitle="3 active" icon={<TrendingUp size={16} />} />
              <StrategyWidget />
            </div>
          </WidgetCell>
        )}

        {/* Timeline */}
        {w.timeline && (
          <WidgetCell index={5} widgetId={WIDGET_IDS.timeline} colSpan={getLayout('timeline', w.timeline.colSpan, w.timeline.rowSpan).colSpan} rowSpan={getLayout('timeline', w.timeline.colSpan, w.timeline.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('timeline', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Timeline" subtitle="Live" icon={<Activity size={16} />} />
              <TimelineWidget />
            </div>
          </WidgetCell>
        )}

        {/* System Health */}
        {w.health && (
          <WidgetCell index={6} widgetId={WIDGET_IDS.health} colSpan={getLayout('health', w.health.colSpan, w.health.rowSpan).colSpan} rowSpan={getLayout('health', w.health.colSpan, w.health.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('health', c, r)}>
            <div className={panel}>
              <WidgetHeader title="System Health" subtitle="98% healthy" icon={<Gauge size={16} />} />
              <HealthWidget />
            </div>
          </WidgetCell>
        )}

        {/* Replay Controls */}
        {w.replay && (
          <WidgetCell index={7} widgetId={WIDGET_IDS.replay} colSpan={getLayout('replay', w.replay.colSpan, w.replay.rowSpan).colSpan} rowSpan={getLayout('replay', w.replay.colSpan, w.replay.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('replay', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Replay Engine" subtitle="BTC Demo · 09:42" icon={<Play size={16} />} />
              <ReplayWidget />
            </div>
          </WidgetCell>
        )}

        {/* Opportunities */}
        {w.opportunities && (
          <WidgetCell index={8} widgetId={WIDGET_IDS.opportunities} colSpan={getLayout('opportunities', w.opportunities.colSpan, w.opportunities.rowSpan).colSpan} rowSpan={getLayout('opportunities', w.opportunities.colSpan, w.opportunities.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('opportunities', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Opportunities" subtitle="12 active" icon={<Zap size={16} />} />
              <OpportunitiesWidget />
            </div>
          </WidgetCell>
        )}

        {/* PnL Overview */}
        {w.pnl && (
          <WidgetCell index={9} widgetId={WIDGET_IDS.pnl} colSpan={getLayout('pnl', w.pnl.colSpan, w.pnl.rowSpan).colSpan} rowSpan={getLayout('pnl', w.pnl.colSpan, w.pnl.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('pnl', c, r)}>
            <div className={panel}>
              <WidgetHeader title="PnL 24h" subtitle="+$12,484" icon={<BarChart3 size={16} />} />
              <PnLWidget />
            </div>
          </WidgetCell>
        )}

        {/* Chart */}
        {w.chart && (
          <WidgetCell index={10} widgetId={WIDGET_IDS.chart} colSpan={getLayout('chart', w.chart.colSpan, w.chart.rowSpan).colSpan} rowSpan={getLayout('chart', w.chart.colSpan, w.chart.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('chart', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Chart" subtitle="BTC/USDT · 1m" icon={<CandlestickChart size={16} />} />
              <ChartWidget />
            </div>
          </WidgetCell>
        )}

        {/* Order Book */}
        {w.orderbook && (
          <WidgetCell index={11} widgetId={WIDGET_IDS.orderbook} colSpan={getLayout('orderbook', w.orderbook.colSpan, w.orderbook.rowSpan).colSpan} rowSpan={getLayout('orderbook', w.orderbook.colSpan, w.orderbook.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('orderbook', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Order Book" subtitle="BTC/USDT" icon={<BarChart3 size={16} />} />
              <OrderBookWidget />
            </div>
          </WidgetCell>
        )}

        {/* Workspace Status */}
        {w.workspaceStatus && (
          <WidgetCell index={12} widgetId={WIDGET_IDS.workspaceStatus} colSpan={getLayout('workspaceStatus', w.workspaceStatus.colSpan, w.workspaceStatus.rowSpan).colSpan} rowSpan={getLayout('workspaceStatus', w.workspaceStatus.colSpan, w.workspaceStatus.rowSpan).rowSpan} onResize={(c, r) => setWidgetLayout('workspaceStatus', c, r)}>
            <div className={panel}>
              <WidgetHeader title="Workspace Status" subtitle="All systems nominal" icon={<RefreshCw size={16} />} />
              <WorkspaceStatusWidget />
            </div>
          </WidgetCell>
        )}
      </WidgetGrid>
    </div>
  );
}
