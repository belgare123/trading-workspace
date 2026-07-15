import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  variant?: 'underline' | 'pills' | 'segment';
  size?: 'sm' | 'md';
}

export function Tabs({ tabs, activeTab, onTabChange, variant = 'underline', size = 'md', className, ...props }: TabsProps) {
  const base = 'inline-flex items-center';
  const wrapper = variant === 'segment'
    ? 'bg-[var(--surface-1)] rounded-xl p-1 gap-0 border border-[var(--border-base)]'
    : 'gap-1';

  const tabBase = {
    underline: 'px-3 py-2 text-sm font-medium border-b-2 border-transparent transition-all duration-150',
    pills: 'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150',
    segment: 'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 border border-transparent',
  };

  const activeMap = {
    underline: 'text-[var(--text-primary)] border-[var(--accent-blue)]',
    pills: 'text-[var(--text-primary)] bg-[var(--surface-2)]',
    segment: 'text-[var(--text-primary)] bg-[var(--surface-3)] border-[var(--border-accent)] shadow-sm',
  };

  const idleMap = {
    underline: 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border-transparent',
    pills: 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
    segment: 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border-transparent',
  };

  return (
    <div className={cn(base, wrapper, className)} {...props}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(tabBase[variant], isActive ? activeMap[variant] : idleMap[variant], 'cursor-pointer')}
          >
            <span className="flex items-center gap-2">
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-medium',
                  isActive ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)]' : 'bg-[var(--surface-1)] text-[var(--text-muted)]'
                )}>
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
