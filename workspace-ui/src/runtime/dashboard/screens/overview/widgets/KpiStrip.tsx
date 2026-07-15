import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { KpiData } from '../../../data/types'

/**
 * KPI Strip — top-level performance metrics.
 * Displays: Equity, PnL (daily/total), Open Positions, Win Rate, Active Strategies, Runtime Health.
 */
export const KpiStrip: FC = () => {
  const data = useDataProvider<KpiData>('kpi-strip')

  if (!data) {
    return <div className="widget-panel kpi-strip"><div className="widget-loading">Loading KPIs…</div></div>
  }

  const cards = [
    { label: 'Equity', value: formatUSD(data.equity), cls: 'kpi-equity' },
    { label: 'PnL Daily', value: formatUSD(data.pnlDaily), cls: data.pnlDaily >= 0 ? 'kpi-positive' : 'kpi-negative' },
    { label: 'Open Positions', value: String(data.openPositions), cls: 'kpi-positions' },
    { label: 'Win Rate', value: `${data.winRate.toFixed(1)}%`, cls: data.winRate >= 50 ? 'kpi-positive' : 'kpi-negative' },
    { label: 'Active Strategies', value: String(data.activeStrategies), cls: 'kpi-strategies' },
    { label: 'Runtime Health', value: `${data.runtimeHealth.toFixed(1)}%`, cls: data.runtimeHealth >= 95 ? 'kpi-healthy' : 'kpi-warning' },
  ]

  return (
    <div className={cn('widget-panel kpi-strip', 'grid grid-cols-6 gap-3')}>
      {cards.map(card => (
        <div key={card.label} className={cn('kpi-card', card.cls)}>
          <div className="kpi-label">{card.label}</div>
          <div className="kpi-value">{card.value}</div>
        </div>
      ))}
    </div>
  )
}

function formatUSD(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}
