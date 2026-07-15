import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
  icon?: ReactNode;
  children: ReactNode;
}

const chipVariants = {
  default: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-base)]',
  success: 'bg-[var(--success-bg)] text-[var(--text-success)] border border-[var(--success)]/20',
  warning: 'bg-[var(--warning-bg)] text-[var(--text-warning)] border border-[var(--warning)]/20',
  danger: 'bg-[var(--danger-bg)] text-[var(--text-danger)] border border-[var(--danger)]/20',
  info: 'bg-[var(--info-bg)] text-[var(--text-link)] border border-[var(--accent-blue)]/20',
  accent: 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/20',
};

const chipSizes = {
  sm: 'text-2xs px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

export function Chip({ variant = 'default', size = 'sm', removable, onRemove, icon, className, children, ...props }: ChipProps) {
  return (
    <span className={cn('inline-flex items-center font-medium rounded-md', chipVariants[variant], chipSizes[size], className)} {...props}>
      {icon && <span className="flex-shrink-0 w-3 h-3">{icon}</span>}
      {children}
      {removable && (
        <button
          onClick={e => { e.stopPropagation(); onRemove?.(); }}
          className="flex-shrink-0 w-3.5 h-3.5 rounded-full hover:bg-black/20 flex items-center justify-center transition-colors ml-0.5"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l6 6M7 1l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
}
