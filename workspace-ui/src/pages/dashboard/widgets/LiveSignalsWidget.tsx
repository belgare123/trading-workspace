import { useQuery } from '@tanstack/react-query';

interface ScannerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  score: number;
  signals: string[];
  direction: string;
  timestamp: number;
}

function fmtPrice(v: number): string {
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function LiveSignalsWidget() {
  const { data: scanner } = useQuery<ScannerItem[]>({
    queryKey: ['scanner'],
    queryFn: () => fetch('/api/v1/scanner').then(r => r.json()),
    refetchInterval: 10_000,
  });

  const { data: strategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => fetch('/api/v1/strategies').then(r => r.json()),
    refetchInterval: 15_000,
  });

  // Show top 5 scanner items sorted by score
  const top5 = [...(scanner ?? [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!top5.length) {
    return <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>No live data available</div>;
  }

  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="space-y-2.5">
      {top5.map(item => {
        const isLong = item.direction === 'long';
        return (
          <div
            key={item.symbol}
            className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-3.5"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-semibold text-sm text-[var(--text-primary)]">
                  {item.symbol}
                </span>
                <span
                  className={`inline-flex items-center text-2xs font-bold px-1.5 py-0.5 rounded ${
                    isLong
                      ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]'
                      : 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]'
                  }`}
                >
                  {isLong ? '▲ LONG' : '▼ SHORT'}
                </span>
              </div>
              <span className="text-2xs text-[var(--text-muted)] font-mono">{now}</span>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-2">
              <div>
                <span className="text-2xs text-[var(--text-muted)] block">Price</span>
                <span className="text-xs font-semibold text-[var(--text-primary)] font-mono">
                  {fmtPrice(item.price)}
                </span>
              </div>
              <div>
                <span className="text-2xs text-[var(--text-muted)] block">Change</span>
                <span className={`text-xs font-semibold font-mono ${item.changePercent >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-2xs text-[var(--text-muted)] block">Volume</span>
                <span className="text-xs font-semibold text-[var(--text-primary)] font-mono">
                  {(item.volume / 1000).toFixed(1)}K
                </span>
              </div>
              <div>
                <span className="text-2xs text-[var(--text-muted)] block">Score</span>
                <span className={`text-xs font-semibold font-mono ${
                  item.score >= 70 ? 'text-[#22c55e]' : item.score >= 40 ? 'text-[#eab308]' : 'text-[#ef4444]'
                }`}>
                  {item.score}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {!scanner && strategies && (
        <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-muted)' }}>
          ⋮ {Array.isArray(strategies) ? strategies.length : 0} strategies active
        </div>
      )}
    </div>
  );
}
