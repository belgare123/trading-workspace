import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { MarketOrderBook } from '../types'

export const OrderBookWidget: FC = () => {
  const ob = useDataProvider<MarketOrderBook>('market-orderbook')

  if (!ob) return <div className="widget-panel"><div className="widget-loading">Loading order book…</div></div>

  return (
    <div className={cn('widget-panel', 'orderbook')}>
      <div className="widget-title">📊 Order Book — {ob.symbol}</div>
      <div style={{ fontSize: 11, width: '100%' }}>
        <div style={{ fontWeight: 600, padding: '2px 8px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          <span>Price</span><span>Size</span><span>Total</span>
        </div>
        {/* Asks (reversed — highest closest to middle) */}
        {[...ob.asks].reverse().slice(0, 8).map((a, i) => (
          <div key={`a-${i}`} style={{ padding: '1px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, color: 'var(--ask)' }}>
            <span>{a.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span>{a.size.toFixed(4)}</span>
            <span>{a.total.toFixed(4)}</span>
          </div>
        ))}
        {/* Spread */}
        <div style={{ padding: '2px 8px', fontWeight: 600, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'center', fontSize: 10 }}>
          Spread: ${ob.spread.toFixed(2)}
        </div>
        {/* Bids */}
        {ob.bids.slice(0, 8).map((b, i) => (
          <div key={`b-${i}`} style={{ padding: '1px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, color: 'var(--bid)' }}>
            <span>{b.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span>{b.size.toFixed(4)}</span>
            <span>{b.total.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
