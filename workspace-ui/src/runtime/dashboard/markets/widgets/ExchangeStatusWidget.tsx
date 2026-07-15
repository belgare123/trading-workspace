import type { FC } from 'react'
import { cn } from '../../../../lib/utils'
import { useDataProvider } from '../../runtime/useDataProvider'
import type { ExchangeStatus } from '../types'

export const ExchangeStatusWidget: FC = () => {
  const status = useDataProvider<ExchangeStatus>('market-exchange-status')

  if (!status) return <div className="widget-panel"><div className="widget-loading">Loading exchange status…</div></div>

  return (
    <div className={cn('widget-panel', 'exchange-status')}>
      <div className="widget-title">🔌 Exchange Status</div>
      <div style={{ fontSize: 12, padding: '4px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>{status.exchange}</span>
          <span style={{ color: status.connected ? 'var(--positive)' : 'var(--negative)' }}>
            {status.connected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11 }}>
          <span>Latency: <strong>{status.latencyMs}ms</strong></span>
          <span>Uptime: <strong>{status.uptime}%</strong></span>
        </div>
        {status.lastReconnect && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
            Last reconnect: {new Date(status.lastReconnect).toLocaleTimeString()}
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
          {status.services.map((s: { name: string; status: string }) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
              <span>{s.name}</span>
              <span style={{
                color: s.status === 'online' ? 'var(--positive)' : s.status === 'degraded' ? 'var(--warning)' : 'var(--negative)',
              }}>
                ● {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
