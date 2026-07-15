
import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  variant?: 'default' | 'glass' | 'elevated';
  action?: ReactNode;
}

export function Panel({ children, title, icon, variant = 'glass', action, className, ...props }: PanelProps) {
  const variants = {
    default: 'bg-[var(--surface-1)] border-[var(--border-base)]',
    glass: 'bg-[rgba(11,14,20,0.6)] border-[var(--border-subtle)] backdrop-blur-[12px]',
    elevated: 'bg-[var(--surface-1)] border-[var(--border-base)] shadow-lg',
  };
  return (
    <div className={cn('rounded-xl border overflow-hidden', variants[variant], className)} {...props}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-base)]">
          <div className="flex items-center gap-2">
            {icon && <span className="w-4 h-4 text-[var(--text-tertiary)]">{icon}</span>}
            <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
