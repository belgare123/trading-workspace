import { useStore } from '../store';

const PRESETS: { id: string; label: string }[] = [
  { id: 'default', label: 'Overview' },
  { id: 'trading', label: 'Trading' },
  { id: 'signals-focus', label: 'Signals Focus' },
  { id: 'research', label: 'Research' },
  { id: 'monitoring', label: 'Monitoring' },
];

export function DashboardPresetSwitcher() {
  const activePreset = useStore((s) => s.dashboardPreset);
  const setPreset = useStore((s) => s.setDashboardPreset);
  const activeView = useStore((s) => s.activeView);

  if (activeView !== 'dashboard') return null;

  return (
    <div className="presets" style={{ marginBottom: 4 }}>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => setPreset(p.id)}
          title={`Dashboard: ${p.label}`}
          className={`preset-pill${activePreset === p.id ? ' active' : ''}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
