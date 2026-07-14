import { useStore } from '../store'

export function StatusBar() {
  const metrics = useStore((s) => s.metrics)
  const replay = useStore((s) => s.replay)
  const timelineOpen = useStore((s) => s.timelineOpen)

  return (
    <footer className="h-7 flex items-center justify-between px-4 bg-status-bg border-t border-border text-xs text-surface-600" role="contentinfo" aria-label="Status bar">
      <div className="flex items-center gap-4" aria-live="polite">
        <button
          onClick={(e) => {
            e.stopPropagation()
            useStore.getState().toggleTimeline()
          }}
          style={{
            background: timelineOpen ? 'var(--c-accent)' : 'transparent',
            color: timelineOpen ? '#fff' : '#5b6a7a',
            border: `1px solid ${timelineOpen ? 'var(--c-accent)' : '#2c2e33'}`,
            borderRadius: 3,
            padding: '1px 6px',
            fontSize: 10,
            cursor: 'pointer',
            lineHeight: '16px',
          }}
          title="Toggle Timeline"
          aria-label={timelineOpen ? 'Close timeline panel' : 'Open timeline panel'}
          aria-expanded={timelineOpen}
        >
          Timeline
        </button>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
          Connected
        </span>
        {metrics.slice(0, 3).map((m) => (
          <span key={m.name}>
            {m.name}: {m.value}
            {m.unit}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {replay.status !== 'idle' && (
          <span className="text-accent-cyan">
            {replay.status === 'playing' ? '▶' : '⏸'} {replay.speed}x
          </span>
        )}
        <span className="text-surface-600">v1.0.0</span>
      </div>
    </footer>
  )
}
