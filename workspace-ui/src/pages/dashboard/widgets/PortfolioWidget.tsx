
import { cn } from '../../../lib/utils';

const holdings = [
  { pair: 'BTC/USDT', amount: '0.42', value: '$27,922', pnl: '+$1,842', pnlPct: '+7.1%', dir: 'up' as const },
  { pair: 'ETH/USDT', amount: '4.80', value: '$16,560', pnl: '+$420', pnlPct: '+2.6%', dir: 'up' as const },
  { pair: 'SOL/USDT', amount: '85.00', value: '$12,155', pnl: '-$245', pnlPct: '-2.0%', dir: 'down' as const },
  { pair: 'BNB/USDT', amount: '12.50', value: '$7,217', pnl: '+$512', pnlPct: '+7.6%', dir: 'up' as const },
];

export function PortfolioWidget() {
  const total = '$63,854';
  const totalPnl = '+$2,529';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between pb-1 border-b border-[var(--border-base)]">
        <span className="text-2xs text-[var(--text-muted)] uppercase tracking-wider">Total Value</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[var(--text-primary)]">{total}</span>
          <span className="text-xs font-semibold text-[var(--accent-green)]">{totalPnl}</span>
        </div>
      </div>
      {holdings.map(h => (
        <div key={h.pair} className="flex items-center justify-between group hover:bg-[var(--surface-2)] -mx-2 px-2 py-1 rounded-lg transition-all">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-xs text-[var(--text-primary)]">{h.pair}</span>
            <span className="text-2xs text-[var(--text-muted)]">{h.amount}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--text-secondary)]">{h.value}</span>
            <span className={cn('text-xs font-mono font-semibold', h.dir === 'up' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>
              {h.pnl}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
