import { useQuery } from '@tanstack/react-query';
import { Badge, Progress } from '../../../ui';

interface Strategy {
  id: string;
  name: string;
  symbol: string;
  status: string;
  type: string;
  timeframe: string;
  metrics: {
    pnl: number;
    pnl_percent: number;
    win_rate: number;
    profit_factor: number;
    sharpe: number;
    max_drawdown: number;
    total_trades: number;
  };
}

function fmt(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function StrategyWidget() {
  const { data: strategies } = useQuery<Strategy[]>({
    queryKey: ['strategies'],
    queryFn: () => fetch('/api/v1/strategies').then(r => r.json()),
    refetchInterval: 15_000,
  });

  if (!strategies?.length) {
    return <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>No strategies loaded</div>;
  }

  return (
    <div className="space-y-2.5">
      {strategies.map(s => (
        <div
          key={s.id}
          className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-3.5 transition-all duration-150 hover:border-[var(--border-hover)]"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{s.name}</span>
              <span className="text-2xs text-[var(--text-muted)] ml-2">{s.symbol}</span>
            </div>
            <span className={`text-sm font-bold font-mono ${s.metrics.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {s.metrics.pnl >= 0 ? '+' : ''}${fmt(s.metrics.pnl)}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={s.status === 'running' ? 'success' : 'warning'} size="sm">
              {s.status === 'running' ? '● Running' : '○ Paused'}
            </Badge>
            <span className="text-2xs text-[var(--text-muted)]">{s.type} · {s.timeframe}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-2xs text-[var(--text-muted)]">
            <span>WR {s.metrics.win_rate}%</span>
            <span>PF {s.metrics.profit_factor.toFixed(2)}</span>
            <span>Trades {s.metrics.total_trades}</span>
          </div>
          <Progress value={Math.min(Math.abs(s.metrics.pnl_percent) * 2, 100)} variant={s.metrics.pnl >= 0 ? 'success' : 'danger'} size="sm" />
        </div>
      ))}
    </div>
  );
}
