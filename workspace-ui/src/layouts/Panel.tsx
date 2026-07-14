import type { ReactNode } from 'react'

export function Panel({ children }: { children?: ReactNode }) {
  return (
    <aside className="w-80 flex-shrink-0 bg-panel-bg border-l border-border overflow-y-auto">
      <div className="p-3 text-xs text-surface-600 font-medium uppercase tracking-wider border-b border-border">
        Details
      </div>
      <div className="p-3 text-sm text-surface-700">
        {children || 'Select an item to inspect'}
      </div>
    </aside>
  )
}
