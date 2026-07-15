import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { Alert } from '../types'

export const ActiveAlertsWidget: FC = () => {
  const alerts = useDataProvider<Alert[]>('market-alerts')

  if (!alerts) return <div className="widget-panel"><div className="widget-loading">Loading alerts…</div></div>

  return (
    <div className={cn('widget-panel', 'active-alerts')}>
      <div className="widget-title">🔔 Active Alerts</div>
      <div style={{ fontSize: 11, maxHeight: 250, overflowY: 'auto' }}>
        {alerts.map((a: Alert) => (
          <div key={a.id} style={{
            padding: '4px 8px',
            borderBottom: '1px solid var(--border-subtle)',
            borderLeft: `3px solid ${
              a.severity === 'critical' ? 'var(--negative)' :
              a.severity === 'warning' ? 'var(--warning)' : 'var(--info)'
            }`,
            opacity: a.acknowledged ? 0.6 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 600 }}>
                {a.symbol !== 'SYSTEM' ? a.symbol : '🔧'} · {a.type}
              </span>
              <span style={{
                color: a.severity === 'critical' ? 'var(--negative)' :
                       a.severity === 'warning' ? 'var(--warning)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: 10, textTransform: 'uppercase',
              }}>
                {a.severity}
              </span>
            </div>
            <div style={{ fontSize: 10 }}>{a.message}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              {new Date(a.timestamp).toLocaleTimeString()}
              {a.acknowledged ? ' · acknowledged' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
