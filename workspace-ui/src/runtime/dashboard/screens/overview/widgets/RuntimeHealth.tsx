import type { FC } from 'react'
import { cn } from '../../../../../lib/utils'
import { useDataProvider } from '../../../runtime/useDataProvider'
import type { RuntimeHealthData } from '../../../data/types'

const statusDot: Record<string, string> = {
  healthy: '🟢',
  degraded: '🟡',
  down: '🔴',
}

export const RuntimeHealth: FC = () => {
  const data = useDataProvider<RuntimeHealthData>('runtime-health')

  if (!data) {
    return <div className="widget-panel runtime-health"><div className="widget-loading">Loading health…</div></div>
  }

  return (
    <div className={cn('widget-panel runtime-health')}>
      <div className="widget-title">Runtime Health</div>
      <div className="health-metrics grid grid-cols-3 gap-2">
        <Metric label="Memory" value={`${data.memoryUsage}%`} bar={data.memoryUsage} />
        <Metric label="Throughput" value={`${data.eventThroughput}/s`} bar={Math.min(data.eventThroughput / 30, 100)} />
        <Metric label="Plugins" value={`${data.pluginsActive}/${data.pluginsTotal}`} bar={(data.pluginsActive / data.pluginsTotal) * 100} />
      </div>
      <div className="health-services">
        {data.services.map(svc => (
          <div key={svc.name} className="health-row">
            <span>{statusDot[svc.status] ?? '⚪'}</span>
            <span className="health-name">{svc.name}</span>
            <span className={cn('health-status', svc.status)}>{svc.status}</span>
            <span className="health-latency">{svc.latency}ms</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value, bar }: { label: string; value: string; bar: number }) {
  return (
    <div className="health-metric">
      <div className="health-metric-header">
        <span className="health-metric-label">{label}</span>
        <span className="health-metric-value">{value}</span>
      </div>
      <div className="health-bar-bg"><div className="health-bar" style={{ width: `${Math.min(bar, 100)}%` }} /></div>
    </div>
  )
}
