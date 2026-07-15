import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { DepthPoint } from '../types'

export const MarketDepthWidget: FC = () => {
  const depth = useDataProvider<DepthPoint[]>('market-depth')

  if (!depth) return <div className="widget-panel"><div className="widget-loading">Loading depth…</div></div>

  const maxVol = Math.max(...depth.map((d: DepthPoint) => Math.max(d.bidVolume, d.askVolume)), 1)

  return (
    <div className={cn('widget-panel', 'market-depth')}>
      <div className="widget-title">📈 Market Depth</div>
      <div style={{ fontSize: 11, width: '100%' }}>
        <div style={{ fontWeight: 600, padding: '2px 8px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 4 }}>
          <span>Price</span><span>Bid Vol</span><span>Ask Vol</span>
        </div>
        {depth.map((d: DepthPoint, i: number) => (
          <div key={i}  style={{ padding: '1px 8px', display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 4, position: 'relative' }}>
            <span>{d.price.toFixed(2)}</span>
            <span style={{ color: 'var(--bid)' }}>{d.bidVolume.toFixed(0)}</span>
            <span style={{ color: 'var(--ask)' }}>{d.askVolume.toFixed(0)}</span>
            {/* Mini bar visualization */}
            <div style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${(d.bidVolume / maxVol) * 50}%`, background: 'var(--bid)', opacity: 0.3 }} />
            <div style={{ position: 'absolute', right: 0, bottom: 0, height: 2, width: `${(d.askVolume / maxVol) * 50}%`, background: 'var(--ask)', opacity: 0.3 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
