import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { LiveSignalsData } from '../../../data/types'

export const LiveSignals: FC = () => {
  const data = useDataProvider<LiveSignalsData>('live-signals')

  if (!data) {
    return <div className="widget-panel live-signals"><div className="widget-loading">Loading signals…</div></div>
  }

  const dirColor = (d: string) => d === 'LONG' ? 'positive' : 'negative'
  const confColor = (c: number) => c >= 80 ? 'high' : c >= 65 ? 'mid' : 'low'

  return (
    <div className={cn('widget-panel live-signals')}>
      <div className="widget-title">Live Signals ({data.total})</div>
      <div className="signals-scroll">
        {data.signals.slice(0, 8).map(s => (
          <div key={s.id} className="signal-row">
            <div className="signal-symbol">{s.symbol}</div>
            <span className={cn('signal-direction', dirColor(s.direction))}>{s.direction}</span>
            <div className={cn('signal-confidence', confColor(s.confidence))}>{s.confidence}%</div>
            <div className="signal-model">{s.model}</div>
            <div className="signal-time">{timeAgo(s.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  return `${min}m ago`
}
