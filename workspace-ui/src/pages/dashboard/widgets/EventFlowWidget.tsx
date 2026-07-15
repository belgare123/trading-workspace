import { cn } from '../../../lib/utils';

const stages = [
  { id: 'market', label: 'Market', description: 'Price feeds aggregated', status: 'done' as const, time: '09:42:30' },
  { id: 'features', label: 'Features', description: 'Technical indicators computed', status: 'done' as const, time: '09:42:31' },
  { id: 'context', label: 'Context', description: 'Market regime classified', status: 'done' as const, time: '09:42:32' },
  { id: 'decision', label: 'Decision', description: 'Opportunity scored 0.89', status: 'done' as const, time: '09:42:33' },
  { id: 'risk', label: 'Risk', description: 'Risk check passed', status: 'done' as const, time: '09:42:34' },
  { id: 'signal', label: 'Signal', description: 'SIG-2026-0714-0892', status: 'active' as const, time: '09:42:35' },
  { id: 'trade', label: 'Trade', description: 'Awaiting execution', status: 'pending' as const, time: '—' },
  { id: 'portfolio', label: 'Portfolio', description: 'Position update pending', status: 'pending' as const, time: '—' },
];

const statusStyles = {
  done: {
    dot: 'bg-[var(--accent-green)] border-[var(--accent-green)]',
    line: 'bg-[var(--accent-green)]',
    text: 'text-[var(--text-primary)]',
    desc: 'text-[var(--text-secondary)]',
  },
  active: {
    dot: 'bg-[var(--accent-blue)] border-[var(--accent-blue)] shadow-[0_0_12px_rgba(85,125,242,0.4)]',
    line: 'bg-gradient-to-b from-[var(--accent-blue)] to-[var(--border-base)]',
    text: 'text-[var(--accent-blue)] font-semibold',
    desc: 'text-[var(--text-secondary)]',
  },
  pending: {
    dot: 'bg-[var(--surface-3)] border-[var(--border-base)]',
    line: 'bg-[var(--border-subtle)]',
    text: 'text-[var(--text-tertiary)]',
    desc: 'text-[var(--text-muted)]',
  },
};

function FlowDot({ status }: { status: 'done' | 'active' | 'pending' }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className={cn(
        'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-300',
        statusStyles[status].dot,
        status === 'active' && 'animate-pulse-glow',
      )}>
        {status === 'done' && (
          <svg width="6" height="6" viewBox="0 0 6 6" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M1 3l1.5 1.5L5 1.5" />
          </svg>
        )}
      </div>
    </div>
  );
}

export function EventFlowWidget() {
  return (
    <div className="flex flex-col relative pl-5">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex gap-4 pb-0 relative">
          {/* Pipeline line */}
          {i < stages.length - 1 && (
            <div className={cn(
              'absolute left-[6px] top-[18px] w-[2px] h-[calc(100%+8px)]',
              statusStyles[stage.status].line,
            )} />
          )}

          {/* Dot */}
          <div className="relative z-10 pt-1">
            <FlowDot status={stage.status} />
          </div>

          {/* Content */}
          <div className={cn('flex-1 pb-5', statusStyles[stage.status].text)}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{stage.label}</span>
              <span className="text-2xs text-[var(--text-muted)] font-mono">{stage.time}</span>
            </div>
            <span className={cn('text-xs', statusStyles[stage.status].desc)}>{stage.description}</span>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(85,125,242,0.4); }
          50% { box-shadow: 0 0 16px 4px rgba(85,125,242,0.15); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
