import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { NotificationsData } from '../../../data/types'

const severityIcon: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  critical: '🚨',
}

export const Notifications: FC = () => {
  const data = useDataProvider<NotificationsData>('notifications')

  if (!data) {
    return <div className="widget-panel notifications"><div className="widget-loading">Loading notifications…</div></div>
  }

  return (
    <div className={cn('widget-panel notifications')}>
      <div className="widget-title">
        Notifications
        {data.unread > 0 && <span className="notif-badge">{data.unread}</span>}
      </div>
      <div className="notif-scroll">
        {data.notifications.slice(0, 8).map(n => (
          <div key={n.id} className={cn('notif-row', n.severity, { unread: !n.read })}>
            <span className="notif-icon">{severityIcon[n.severity] ?? '📋'}</span>
            <div className="notif-body">
              <div className="notif-title">{n.title}</div>
              <div className="notif-message">{n.message}</div>
              <div className="notif-time">{timeAgo(n.timestamp)}</div>
            </div>
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
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  return `${hrs}h ago`
}
