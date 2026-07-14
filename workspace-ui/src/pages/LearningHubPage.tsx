import { useState } from 'react'
import LearningCenterPage from './LearningCenterPage'
import MLWorkbenchPage from './MLWorkbenchPage'

type HubTab = 'docs' | 'ml'

export default function LearningHubPage() {
  const [tab, setTab] = useState<HubTab>('docs')

  return (
    <div className="flex flex-col h-full">
      {/* ── Hub Tabs ── */}
      <div className="flex gap-1 border-b border-border px-4 bg-surface-100 shrink-0">
        <button
          onClick={() => setTab('docs')}
          className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            tab === 'docs'
              ? 'text-primary-400 border-primary-500'
              : 'text-surface-600 border-transparent hover:text-surface-700'
          }`}
        >
          📚 Documentation
        </button>
        <button
          onClick={() => setTab('ml')}
          className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            tab === 'ml'
              ? 'text-primary-400 border-primary-500'
              : 'text-surface-600 border-transparent hover:text-surface-700'
          }`}
        >
          🧠 ML Workbench
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0">
        {tab === 'docs' ? <LearningCenterPage /> : <MLWorkbenchPage />}
      </div>
    </div>
  )
}
