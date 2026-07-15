import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { WatchlistRow } from '../types'

export const MarketWatchlistWidget: FC = () => {
  const rows = useDataProvider<WatchlistRow[]>('market-watchlist')

  if (!rows) return <div className="widget-panel"><div className="widget-loading">Loading watchlist…</div></div>

  return (
    <div className={cn('widget-panel', 'market-watchlist')}>
      <div className="widget-title">📋 Market Watchlist</div>
      <div className="watchlist-table" style={{ fontSize: 12, width: '100%' }}>
        <div className="watchlist-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '4px 8px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
          <span>Symbol</span><span>Price</span><span>24h</span><span>Vol</span>
        </div>
        {rows.map(r => (
          <div key={r.symbol} className="watchlist-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '3px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontWeight: 600 }}>{r.symbol} {r.signal ? <span className={r.signal === 'LONG' ? 'positive' : 'negative'}>{r.signal === 'LONG' ? '▲' : '▼'}</span> : null}</span>
            <span>${r.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className={r.change24h >= 0 ? 'positive' : 'negative'}>{r.change24h >= 0 ? '+' : ''}{r.change24h.toFixed(2)}%</span>
            <span>{formatVol(r.volume)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}
