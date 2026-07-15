const items = [
  { label: 'Runtime', status: 'online' as const, uptime: '12d 7h 31m' },
  { label: 'Event Store', status: 'online' as const, uptime: '12d 7h 31m' },
  { label: 'WebSocket', status: 'online' as const, uptime: '12d 7h 31m' },
  { label: 'Market Data', status: 'online' as const, uptime: '12d 7h 31m' },
  { label: 'Risk Engine', status: 'online' as const, uptime: '12d 7h 31m' },
];

export function WorkspaceStatusWidget() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(item => (
        <div
          key={item.label}
          className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 transition-all duration-150 hover:border-[var(--border-hover)] hover:bg-[rgba(255,255,255,0.03)]"
        >
          <span className="status-dot online" />
          <div className="flex flex-col">
            <span className="text-xs text-[var(--text-sec)]">{item.label}</span>
            <span className="text-2xs text-[var(--text-muted)] font-mono">{item.uptime}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
