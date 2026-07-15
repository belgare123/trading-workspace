import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'

export const TradingChartWidget: FC = () => {
  const price = useDataProvider<number[]>('market-chart')

  if (!price) return <div className="widget-panel"><div className="widget-loading">Loading chart…</div></div>

  return (
    <div className={cn('widget-panel', 'trading-chart')}>
      <div className="widget-title">📈 Trading Chart</div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 200, background: 'var(--bg-secondary)', borderRadius: 4, margin: 4,
        flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          ${price[0]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          BTCUSDT · Live
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          📊 Chart integration coming in next iteration
        </div>
      </div>
    </div>
  )
}
