import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { PortfolioSnapshotData } from '../../../data/types'

export const PortfolioSnapshot: FC = () => {
  const data = useDataProvider<PortfolioSnapshotData>('portfolio-snapshot')

  if (!data) {
    return <div className="widget-panel portfolio-snapshot"><div className="widget-loading">Loading portfolio…</div></div>
  }

  return (
    <div className={cn('widget-panel portfolio-snapshot')}>
      <div className="widget-title">Portfolio</div>
      <div className="portfolio-summary">
        <div className="portfolio-balance">
          <span className="portfolio-label">Balance</span>
          <span className="portfolio-value">{formatUSD(data.balance)}</span>
        </div>
        <div className="portfolio-metrics grid grid-cols-2 gap-2">
          <Metric label="Exposure" value={formatUSD(data.exposure)} />
          <Metric label="Leverage" value={`${data.leverage}x`} />
          <Metric label="PnL" value={`${data.pnlDaily >= 0 ? '+' : ''}${formatUSD(data.pnlDaily)}`} className={data.pnlDaily >= 0 ? 'positive' : 'negative'} />
          <Metric label="Drawdown" value={`${data.drawdown}%`} />
          <Metric label="Risk" value={`${data.risk}/10`} />
        </div>
      </div>
      {data.allocations.length > 0 && (
        <div className="portfolio-allocs">
          <div className="portfolio-label">Allocation</div>
          {data.allocations.slice(0, 6).map(a => (
            <div key={a.symbol} className="alloc-row">
              <span>{a.symbol}</span>
              <div className="alloc-bar-bg"><div className="alloc-bar" style={{ width: `${a.percentage}%` }} /></div>
              <span className={cn(a.pnlUnrealized >= 0 ? 'positive' : 'negative')}>{a.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="portfolio-metric">
      <span className="portfolio-label">{label}</span>
      <span className={cn('portfolio-value-sm', className)}>{value}</span>
    </div>
  )
}

function formatUSD(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}
