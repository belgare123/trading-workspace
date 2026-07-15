const opportunities = [
  { type: 'Momentum', count: 5, pct: 42, color: '#22c55e', top: 'BTC/USDT', conf: 89 },
  { type: 'Breakout', count: 3, pct: 25, color: '#3b82f6', top: 'ETH/USDT', conf: 76 },
  { type: 'Reversal', count: 2, pct: 17, color: '#8b5cf6', top: 'SOL/USDT', conf: 62 },
  { type: 'Mean Rev', count: 2, pct: 16, color: '#eab308', top: 'BNB/USDT', conf: 55 },
];

export function OpportunitiesWidget() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex-shrink-0"
          style={{
            background: `conic-gradient(
              #22c55e 0% 42%,
              #3b82f6 42% 67%,
              #8b5cf6 67% 84%,
              #eab308 84% 100%
            )`,
          }}
        >
          <div className="w-full h-full rounded-full bg-[var(--surface-2)] m-auto"
            style={{ transform: 'scale(0.65)', background: 'var(--surface-2)' }}
          />
        </div>
        <div>
          <span className="text-2xl font-bold text-[var(--text-primary)]">12</span>
          <span className="text-xs text-[var(--text-tertiary)] ml-1.5">active</span>
        </div>
      </div>

      <div className="space-y-2">
        {opportunities.map(o => (
          <div key={o.type} className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />
            <span className="text-xs text-[var(--text-secondary)] flex-1">{o.type}</span>
            <span className="text-xs font-mono text-[var(--text-primary)]">{o.count}</span>
            <div className="w-12 h-1 rounded-full bg-[var(--surface-1)] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${o.pct}%`, background: o.color }} />
            </div>
            <span className="text-2xs text-[var(--text-muted)] font-mono w-16 text-right">{o.top}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
