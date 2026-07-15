import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'subtle' | 'base' | 'accent';
  label?: string;
}

export function Divider({ orientation = 'horizontal', variant = 'base', label, className, ...props }: DividerProps) {
  const colorMap = {
    subtle: 'bg-[var(--border-subtle)]',
    base: 'bg-[var(--border-base)]',
    accent: 'bg-[var(--border-accent)]',
  };

  if (orientation === 'vertical') {
    return (
      <div className={cn('w-px self-stretch', colorMap[variant], className)} {...props} />
    );
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)} {...props}>
        <div className={cn('flex-1 h-px', colorMap[variant])} />
        <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">{label}</span>
        <div className={cn('flex-1 h-px', colorMap[variant])} />
      </div>
    );
  }

  return <hr className={cn('h-px border-0', colorMap[variant], className)} {...props} />;
}
