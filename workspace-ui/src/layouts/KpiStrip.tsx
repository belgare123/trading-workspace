import { useMemo } from 'react'
import { useStore } from '../store'

const DEFAULT_METRICS = [
  { name: 'Runtime', value: 98, unit: '%', status: 'ok' as const },
  { name: 'PnL', value: 12.5, unit: 'K', status: 'ok' as const },
  { name: 'Signals', value: 43, unit: '', status: 'ok' as const },
  { name: 'Events', value: 2.3, unit: 'M', status: 'ok' as const },
  { name: 'CPU', value: 18, unit: '%', status: 'ok' as const },
]

export function KpiStrip() {
  const metrics = useStore((s) => s.metrics)

  const items = useMemo(() => {
    if (metrics.length > 0) return metrics
    return DEFAULT_METRICS
  }, [metrics])

  return (
    <div className="kpi-strip" role="status" aria-label="System metrics">
      {items.map((m) => (
        <div key={m.name} className="kpi-item">
          {m.status === 'ok' && m.name === 'Runtime' && <span className="status-dot online" />}
          {m.status === 'warn' && <span className="status-dot busy" />}
          {m.status === 'error' && <span className="status-dot offline" />}
          <span className="label">{m.name}</span>
          <span className={`value${m.value > 0 && m.name !== 'CPU' && m.name !== 'Runtime' ? ' green' : m.value > 80 && m.name === 'CPU' ? ' red' : ''}`}>
            {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
          </span>
          {m.unit && <span className="unit">{m.unit}</span>}
        </div>
      ))}
      <div className="kpi-item" style={{ marginLeft: 'auto', borderRight: 'none' }}>
        <span className="status-dot online" />
        <span className="label" style={{ fontWeight: 500, color: 'var(--text-sec)' }}>Connected</span>
      </div>
    </div>
  )
}
