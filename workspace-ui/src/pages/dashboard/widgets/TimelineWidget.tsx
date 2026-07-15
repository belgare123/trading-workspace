
import { cn } from '../../../lib/utils';

const events = [
  { time: '09:42', type: 'Close' as const, pair: 'BTC', desc: 'Trade Closed', dir: 'long' as const },
  { time: '09:41', type: 'Signal' as const, pair: 'ETH', desc: 'Signal Created', dir: 'long' as const },
  { time: '09:40', type: 'Alert' as const, pair: 'SOL', desc: 'Risk Warning', dir: 'short' as const },
  { time: '09:38', type: 'Trade' as const, pair: 'BTC', desc: 'Position Opened', dir: 'long' as const },
  { time: '09:35', type: 'Signal' as const, pair: 'XRP', desc: 'Signal Created', dir: 'short' as const },
  { time: '09:32', type: 'Plugin' as const, pair: '', desc: 'Market Maker Started', dir: null },
];

const typeStyles = {
  Close: 'border-[var(--accent-green)] text-[var(--accent-green)]',
  Signal: 'border-[var(--accent-blue)] text-[var(--accent-blue)]',
  Alert: 'border-[var(--accent-red)] text-[var(--accent-red)]',
  Trade: 'border-[var(--accent-gold)] text-[var(--accent-gold)]',
  Plugin: 'border-[var(--text-muted)] text-[var(--text-tertiary)]',
};

export function TimelineWidget() {
  return (
    <div className="flex flex-col gap-1.5">
      {events.map((e, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150 hover:bg-[var(--surface-2)] group"
        >
          <span className="text-2xs font-mono text-[var(--text-muted)] w-8 flex-shrink-0">{e.time}</span>
          <span className={cn('text-2xs px-1.5 py-0.5 rounded border font-medium', typeStyles[e.type])}>{e.type}</span>
          {e.pair && <span className="font-mono font-semibold text-xs text-[var(--text-primary)]">{e.pair}</span>}
          <span className="text-xs text-[var(--text-secondary)] flex-1">{e.desc}</span>
          {e.dir && (
            <span className={cn('text-2xs font-medium', e.dir === 'long' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]')}>
              {e.dir === 'long' ? '↑' : '↓'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
