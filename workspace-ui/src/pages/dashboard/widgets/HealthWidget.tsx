
import { Gauge, Progress } from '../../../ui';

const services = [
  { label: 'Services', value: 100 },
  { label: 'Plugins', value: 92 },
  { label: 'Event Store', value: 100 },
  { label: 'Replay Engine', value: 100 },
  { label: 'Marketplace', value: 98 },
  { label: 'Database', value: 100 },
];

export function HealthWidget() {
  return (
    <div className="flex items-start gap-5">
      <div className="flex-shrink-0">
        <Gauge value={98} variant="gradient" size={90} thickness={7} label="Healthy" />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {services.map(s => (
          <div key={s.label} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">{s.label}</span>
              <span className="text-xs font-mono text-[var(--text-tertiary)]">{s.value}%</span>
            </div>
            <Progress
              value={s.value}
              variant={s.value >= 98 ? 'success' : s.value >= 85 ? 'warning' : 'danger'}
              size="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
