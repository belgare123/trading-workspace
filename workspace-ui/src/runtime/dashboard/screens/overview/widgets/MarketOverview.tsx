import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { MarketOverviewData } from '../../../data/types'

export const MarketOverview: FC = () => {
  const data = useDataProvider<MarketOverviewData>('market-overview')

  if (!data) {
    return <div className="widget-panel market-overview"><div className="widget-loading">Loading market data…</div></div>
  }

  return (
    <div className={cn('widget-panel market-overview')}>
      <div className="widget-title">Market Overview</div>
      <div className="market-assets">
        {data.assets.map(asset => (
          <div key={asset.symbol} className="market-row">
            <div className="market-symbol">{asset.symbol}</div>
            <div className="market-price">{formatUSD(asset.price)}</div>
            <div className={cn('market-change', asset.change24h >= 0 ? 'positive' : 'negative')}>
              {asset.change24h >= 0 ? '▲' : '▼'} {Math.abs(asset.change24h).toFixed(2)}%
            </div>
            <div className="market-volume">Vol: {formatVolume(asset.volume)}</div>
          </div>
        ))}
      </div>
      <div className="market-heatmap-placeholder">📊 Heatmap loading…</div>
    </div>
  )
}

function formatUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}
