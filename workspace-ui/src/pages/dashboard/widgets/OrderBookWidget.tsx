import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrderBook } from '../../../api/orderbook';
import type { OrderBookLevel } from '../../../api/orderbook';

// ── Fallback data ─────────────────────────────────────────────────

function generateFallback(basePrice: number, depth: number): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
  const spread = basePrice * 0.0005;
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  let totalBid = 0, totalAsk = 0;
  for (let i = 0; i < depth; i++) {
    const bidS = 15 - i * 0.8 + Math.random() * 2;
    const askS = 15 - i * 0.8 + Math.random() * 2;
    totalBid += bidS;
    totalAsk += askS;
    bids.push({ price: basePrice - spread * (i + 1), size: +bidS.toFixed(4), total: +totalBid.toFixed(4) });
    asks.push({ price: basePrice + spread * (i + 1), size: +askS.toFixed(4), total: +totalAsk.toFixed(4) });
  }
  return { bids, asks };
}

export function OrderBookWidget() {
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['orderbook', 'BTCUSDT'],
    queryFn: () => fetchOrderBook('BTCUSDT', 12),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const { bids, asks, maxTotal } = useMemo(() => {
    if (apiData?.bids?.length) {
      const all = [...apiData.bids, ...apiData.asks];
      const mt = Math.max(...all.map(l => l.total), 1);
      return { bids: apiData.bids, asks: apiData.asks, maxTotal: mt };
    }
    const fb = generateFallback(66210, 10);
    const mt = Math.max(...[...fb.bids, ...fb.asks].map(l => l.total), 1);
    return { ...fb, maxTotal: mt };
  }, [apiData]);

  return (
    <div className="relative text-xs font-mono">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--surface-card)]/60">
          <div className="w-4 h-4 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (reversed — lowest ask at bottom) */}
      <div className="space-y-[2px]">
        {[...asks].reverse().map((l: OrderBookLevel, i: number) => (
          <div key={`ask-${i}`} className="ob-row relative flex items-center justify-between px-1 py-[1px]">
            <div
              className="absolute inset-y-0 right-0 rounded-sm"
              style={{
                width: `${(l.total / maxTotal) * 100}%`,
                background: 'rgba(239,68,68,0.12)',
              }}
            />
            <span className="relative z-[1] text-[var(--accent-red)]">{l.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="relative z-[1] text-right text-[var(--text-secondary)]">{l.size.toFixed(4)}</span>
            <span className="relative z-[1] text-right text-[var(--text-tertiary)] w-16">{l.total.toFixed(4)}</span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between px-1 py-2 border-t border-b border-[var(--border-base)] my-1 text-[var(--text-muted)]">
        <span>Spread</span>
        <span className="text-[var(--text-primary)]">
          {apiData?.spread ? `$${apiData.spread.toFixed(2)}` : '$33.10'}
        </span>
      </div>

      {/* Bids */}
      <div className="space-y-[2px]">
        {bids.map((l: OrderBookLevel, i: number) => (
          <div key={`bid-${i}`} className="ob-row relative flex items-center justify-between px-1 py-[1px]">
            <div
              className="absolute inset-y-0 right-0 rounded-sm"
              style={{
                width: `${(l.total / maxTotal) * 100}%`,
                background: 'rgba(34,197,94,0.12)',
              }}
            />
            <span className="relative z-[1] text-[var(--accent-green)]">{l.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span className="relative z-[1] text-right text-[var(--text-secondary)]">{l.size.toFixed(4)}</span>
            <span className="relative z-[1] text-right text-[var(--text-tertiary)] w-16">{l.total.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
