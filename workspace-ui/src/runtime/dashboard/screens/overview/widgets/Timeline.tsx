import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { TimelineData } from '../../../data/types'

const typeIcon: Record<string, string> = {
  market: '📈',
  signal: '🔔',
  system: '⚙️',
  trade: '💱',
}

export const Timeline: FC = () => {
  const data = useDataProvider<TimelineData>('event-timeline')

  if (!data) {
    return <div className="widget-panel timeline"><div className="widget-loading">Loading timeline…</div></div>
  }

  return (
    <div className={cn('widget-panel timeline')}>
      <div className="widget-title">Event Timeline</div>
      <div className="timeline-scroll">
        {data.entries.slice(0, 12).map(entry => (
          <div key={entry.id} className="timeline-entry">
            <span className="timeline-icon">{typeIcon[entry.type] ?? '📋'}</span>
            <div className="timeline-body">
              <div className="timeline-summary">{entry.summary}</div>
              <div className="timeline-meta">
                <span className="timeline-topic">{entry.topic}</span>
                <span className="timeline-time">{timeAgo(entry.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  return `${hrs}h ago`
}
