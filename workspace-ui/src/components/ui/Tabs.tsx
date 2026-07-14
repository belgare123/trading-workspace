import type { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  children?: ReactNode
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
            active === tab.id
              ? 'text-primary-400 border-primary-500'
              : 'text-surface-600 border-transparent hover:text-surface-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
