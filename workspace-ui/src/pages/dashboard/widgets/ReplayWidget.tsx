import { Button } from '../../../ui';

export function ReplayWidget() {
  return (
    <div className="flex items-center gap-4">
      <button className="w-10 h-10 rounded-xl bg-[var(--accent-blue)] text-white flex items-center justify-center hover:bg-[var(--accent-blue-hover)] transition-all shadow-lg shadow-[var(--accent-blue)]/20 flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[var(--text-primary)]">BTC Demo · 09:42</span>
          <span className="text-2xs text-[var(--text-muted)]">34 events</span>
        </div>
        <div className="relative h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-[35%] rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-green)]" />
          <div className="absolute top-1/2 -translate-y-1/2 left-[35%] w-3 h-3 rounded-full bg-white border-2 border-[var(--accent-blue)] shadow-md" />
        </div>
      </div>

      <Button variant="primary" size="sm">
        Open Studio →
      </Button>
    </div>
  );
}
