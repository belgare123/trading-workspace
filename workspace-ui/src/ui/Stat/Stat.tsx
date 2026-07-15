import type { HTMLAttributes, ReactNode } from 'react';
import { cn, formatCompact } from '../../lib/utils';

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: ReactNode;
  delta?: { value: number; direction: 'up' | 'down'; label?: string };
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Stat({ label, value, icon, delta, compact, size = 'md', className, ...props }: StatProps) {
  const valueSizes = { sm: 'text-sm', md: 'text-xl', lg: 'text-3xl' };
  const labelSizes = { sm: 'text-2xs', md: 'text-xs', lg: 'text-sm' };

  const deltaColor = delta
    ? delta.direction === 'up' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'
    : '';

  return (
    <div className={cn(
      'flex',
      compact ? 'items-center gap-3' : 'flex-col gap-1',
      className,
    )} {...props}>
      {icon && <div className="text-[var(--text-tertiary)] flex-shrink-0">{icon}</div>}
      <div className="flex flex-col">
        <span className={cn('font-medium text-[var(--text-tertiary)] tracking-wide', labelSizes[size])}>{label}</span>
        <div className="flex items-baseline gap-2.5">
          <span className={cn('font-bold text-[var(--text-primary)] tracking-tight', valueSizes[size])}>
            {typeof value === 'number' ? formatCompact(value) : value}
          </span>
          {delta && (
            <span className={cn('text-sm font-semibold', deltaColor)}>
              {delta.direction === 'up' ? '↑' : '↓'} {Math.abs(delta.value).toFixed(1)}%
              {delta.label && <span className="text-xs text-[var(--text-muted)] ml-1 font-normal">{delta.label}</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
