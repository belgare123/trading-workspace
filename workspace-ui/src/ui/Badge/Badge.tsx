
import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  size?: 'sm' | 'md';
  children: ReactNode;
}

const badgeVariants = {
  default: 'bg-[var(--surface-2)] text-[var(--text-secondary)]',
  success: 'bg-[rgba(46,189,122,0.1)] text-[var(--accent-green)]',
  warning: 'bg-[rgba(212,168,71,0.1)] text-[var(--accent-gold)]',
  danger: 'bg-[rgba(228,86,106,0.1)] text-[var(--accent-red)]',
  info: 'bg-[rgba(85,125,242,0.1)] text-[var(--accent-blue)]',
  accent: 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)]',
};

const badgeSizes = {
  sm: 'text-2xs px-1.5 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export function Badge({ variant = 'default', size = 'sm', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center font-semibold rounded-md', badgeVariants[variant], badgeSizes[size], className)} {...props}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: 'online' | 'warning' | 'error'; className?: string }) {
  const colors = {
    online: 'bg-[var(--accent-green)]',
    warning: 'bg-[var(--accent-gold)]',
    error: 'bg-[var(--accent-red)]',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]', className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', colors[status])} />
      {status}
    </span>
  );
}
