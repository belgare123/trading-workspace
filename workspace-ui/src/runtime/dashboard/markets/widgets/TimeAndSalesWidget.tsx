import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { Trade } from '../types'

export const TimeAndSalesWidget: FC = () => {
  const trades = useDataProvider<Trade[]>('market-trades')

  if (!trades) return <div className="widget-panel"><div className="widget-loading">Loading trades…</div></div>

  return (
    <div className={cn('widget-panel', 'time-sales')}>
      <div className="widget-title">⏱ Time & Sales</div>
      <div style={{ fontSize: 11, width: '100%', maxHeight: 280, overflowY: 'auto' }}>
        <div style={{ fontWeight: 600, padding: '2px 8px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 4 }}>
          <span>Symbol</span><span>Price</span><span>Size</span>
        </div>
        {trades.map(t => (
          <div key={t.id} style={{ padding: '1px 8px', display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>{t.symbol}</span>
            <span>${t.price.toFixed(2)}</span>
            <span className={t.side === 'buy' ? 'positive' : 'negative'}>{t.side === 'buy' ? '▲' : '▼'} {t.volume.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
