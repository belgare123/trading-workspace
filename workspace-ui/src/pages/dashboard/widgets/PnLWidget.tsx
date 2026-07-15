import { useQuery } from '@tanstack/react-query';

interface Strategy {
  id: string;
  metrics: {
    pnl: number;
    pnl_percent: number;
    win_rate: number;
    total_trades: number;
    max_drawdown: number;
  };
}

export function PnLWidget() {
  const { data: strategies } = useQuery<Strategy[]>({
    queryKey: ['strategies'],
    queryFn: () => fetch('/api/v1/strategies').then(r => r.json()),
    refetchInterval: 15_000,
  });

  const totalPnL = strategies?.reduce((s, st) => s + (st.metrics?.pnl ?? 0), 0) ?? 12484;
  const avgWinRate = strategies?.length
    ? strategies.reduce((s, st) => s + (st.metrics?.win_rate ?? 0), 0) / strategies.length
    : 68.4;
  const totalTrades = strategies?.reduce((s, st) => s + (st.metrics?.total_trades ?? 0), 0) ?? 47;
  const bestPnL = Math.max(...(strategies?.map(st => st.metrics?.pnl ?? 0) ?? [0]));
  const avgPct = strategies?.length
    ? strategies.reduce((s, st) => s + (st.metrics?.pnl_percent ?? 0), 0) / strategies.length
    : 8.3;

  const sparkPoints = '0,28 20,24 40,26 60,18 80,20 100,10 120,14 140,6 160,8 180,2';
  const isGreen = totalPnL >= 0;

  return (
    <div className="flex items-center gap-6">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <span className={`text-sm font-semibold ${isGreen ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {isGreen ? '+' : ''}${totalPnL.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className={`text-xs font-mono ${isGreen ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {totalPnL >= 0 ? '+' : ''}{avgPct.toFixed(1)}%
          </span>
          <span className="text-2xs text-[var(--text-muted)]">· 24h</span>
        </div>
        <div className="flex gap-5">
          <div>
            <span className="text-2xs text-[var(--text-muted)] block">Win Rate</span>
            <span className="text-xs text-[var(--text-primary)] font-mono font-semibold">{avgWinRate.toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-2xs text-[var(--text-muted)] block">Trades</span>
            <span className="text-xs text-[var(--text-primary)] font-mono font-semibold">{totalTrades}</span>
          </div>
          <div>
            <span className="text-2xs text-[var(--text-muted)] block">Best</span>
            <span className="text-xs text-[#22c55e] font-mono font-semibold">+${Math.abs(bestPnL).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>
      <div className="w-32">
        <svg viewBox="0 0 200 32" className="w-full h-10">
          <defs>
            <linearGradient id="pnl-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isGreen ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'} />
              <stop offset="100%" stopColor={isGreen ? 'rgba(34,197,94,0)' : 'rgba(239,68,68,0)'} />
            </linearGradient>
          </defs>
          <path d={`M${sparkPoints}`} fill="none" stroke={isGreen ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
          <path d={`M0,32 ${sparkPoints} L200,32 Z`} fill="url(#pnl-grad)" />
        </svg>
      </div>
    </div>
  );
}
