import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { HeatmapCell } from '../types'

export const MarketHeatmapWidget: FC = () => {
  const cells = useDataProvider<HeatmapCell[]>('market-heatmap')

  if (!cells) return <div className="widget-panel"><div className="widget-loading">Loading heatmap…</div></div>

  return (
    <div className={cn('widget-panel', 'market-heatmap')}>
      <div className="widget-title">🔥 Market Heatmap</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, padding: 4 }}>
        {cells.map((c: HeatmapCell) => {
          const intensity = Math.min(Math.abs(c.change24h) / 8, 1)
          const isPositive = c.change24h >= 0
          return (
            <div key={c.symbol} style={{
              padding: 8, borderRadius: 4, textAlign: 'center',
              background: isPositive
                ? `rgba(0, 200, 100, ${0.1 + intensity * 0.5})`
                : `rgba(255, 50, 50, ${0.1 + intensity * 0.5})`,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{c.symbol}</div>
              <div style={{ fontSize: 11 }}>${c.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: isPositive ? 'var(--positive)' : 'var(--negative)' }}>
                {isPositive ? '+' : ''}{c.change24h.toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
