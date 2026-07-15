import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { StrategyStatusData } from '../../../data/types'

const statusColor: Record<string, string> = {
  running: 'green',
  paused: 'yellow',
  error: 'red',
  disabled: 'gray',
}

export const StrategyStatus: FC = () => {
  const data = useDataProvider<StrategyStatusData>('strategy-status')

  if (!data) {
    return <div className="widget-panel strategy-status"><div className="widget-loading">Loading strategies…</div></div>
  }

  return (
    <div className={cn('widget-panel strategy-status')}>
      <div className="widget-title">Strategies</div>
      <div className="strategies-scroll">
        {data.strategies.map(s => (
          <div key={s.id} className="strategy-row">
            <div className="strategy-header">
              <span className={cn('strategy-dot', statusColor[s.status])} />
              <span className="strategy-name">{s.name}</span>
              <span className={cn('strategy-status', statusColor[s.status])}>{s.status}</span>
            </div>
            <div className="strategy-stats grid grid-cols-4 gap-1">
              <Stat label="Signals" value={String(s.signals)} />
              <Stat label="PnL" value={`${s.profit >= 0 ? '+' : ''}${s.profit.toFixed(2)}%`} className={s.profit >= 0 ? 'positive' : 'negative'} />
              <Stat label="Sharpe" value={s.sharpe.toFixed(2)} />
              <Stat label="Win" value={`${s.winrate.toFixed(1)}%`} />
            </div>
            <div className="strategy-metrics grid grid-cols-3 gap-1">
              <Stat label="CPU" value={`${s.cpu}ms`} />
              <Stat label="Latency" value={`${s.latency}ms`} />
              <Stat label="EPS" value={String(s.eventsPerSec)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="strategy-stat">
      <span className="stat-label">{label}</span>
      <span className={cn('stat-value', className)}>{value}</span>
    </div>
  )
}
