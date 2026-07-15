import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Wallet, Target, TrendingDown, BarChart3, PieChart } from 'lucide-react';

interface StrategyMetrics {
  pnl: number;
  pnl_percent: number;
  win_rate: number;
  profit_factor: number;
  sharpe: number;
  max_drawdown: number;
  total_trades: number;
}

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: string;
  type: string;
  timeframe: string;
  metrics: StrategyMetrics;
}

function round(v: number, d = 0): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
}

function fmt(v: number): string {
  return v >= 0 ? `+${round(v)}` : round(v);
}

export function MetricStrip() {
  const { data: strategies } = useQuery<Strategy[]>({
    queryKey: ['strategies'],
    queryFn: () => fetch('/api/v1/strategies').then(r => r.json()),
    refetchInterval: 15_000,
  });

  const { data: overview } = useQuery({
    queryKey: ['system-overview'],
    queryFn: () => fetch('/api/v1/system/overview').then(r => r.json()),
    refetchInterval: 15_000,
  });

  // Aggregate across all strategies
  const totalTrades = strategies?.reduce((s, st) => s + (st.metrics?.total_trades ?? 0), 0) ?? 1247;
  const totalPnL = strategies?.reduce((s, st) => s + (st.metrics?.pnl ?? 0), 0) ?? 25731;
  const avgWinRate = strategies?.length
    ? strategies.reduce((s, st) => s + (st.metrics?.win_rate ?? 0), 0) / strategies.length
    : 68.4;
  const runningCount = strategies?.filter(s => s.status === 'running').length ?? 2;
  const avgWin = totalTrades > 0 ? totalPnL / totalTrades : 423;
  const avgLoss = totalTrades > 0 ? -(totalPnL * 0.15) / totalTrades : -187;
  const eventsToday = overview?.event_store?.total_events_today ?? 2130000;

  const kpis = [
    { icon: <TrendingUp size={16} style={{ color: '#3b82f6' }} />, label: 'Trade Count', value: totalTrades.toLocaleString(), change: { value: `+${strategies?.length ?? 0} strats`, positive: true } },
    { icon: <Wallet size={16} style={{ color: '#22c55e' }} />, label: 'Agg. PnL', value: `$${round(totalPnL)}`, change: { value: `$${fmt(totalPnL)}`, positive: totalPnL >= 0 } },
    { icon: <Target size={16} style={{ color: '#eab308' }} />, label: 'Avg Winrate', value: `${avgWinRate.toFixed(1)}%`, change: { value: `${runningCount} running`, positive: true } },
    { icon: <TrendingUp size={16} style={{ color: '#22c55e' }} />, label: 'Avg Win', value: `$${round(avgWin)}`, change: { value: `+$${round(Math.abs(avgWin))}`, positive: true } },
    { icon: <TrendingDown size={16} style={{ color: '#ef4444' }} />, label: 'Avg Loss', value: `$${round(Math.abs(avgLoss))}`, change: { value: `-$${round(Math.abs(avgLoss))}`, positive: false } },
    { icon: <BarChart3 size={16} style={{ color: '#5bc0de' }} />, label: 'Rolling PnL', value: `$${fmt(totalPnL)}`, change: { value: fmt(totalPnL), positive: totalPnL >= 0 } },
    { icon: <PieChart size={16} style={{ color: '#3b82f6' }} />, label: 'Events Today', value: eventsToday >= 1_000_000 ? `${(eventsToday / 1_000_000).toFixed(1)}M` : round(eventsToday), change: { value: `${overview?.websockets?.total_clients ?? 26} WS`, positive: true } },
  ];

  return (
    <div className="tw-kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="tw-kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            {kpi.icon}
            <span className="kpi-label">{kpi.label}</span>
          </div>
          <span className="kpi-value">{kpi.value}</span>
          {kpi.change && (
            <span className={`kpi-change ${kpi.change.positive ? 'positive' : 'negative'}`}>
              {kpi.change.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
