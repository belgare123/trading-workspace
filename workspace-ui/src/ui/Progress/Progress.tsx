
import { cn } from '../../lib/utils';

export interface ProgressProps {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const colors = {
  default: 'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-green)]',
  success: 'bg-[var(--accent-green)]',
  warning: 'bg-[var(--accent-gold)]',
  danger: 'bg-[var(--accent-red)]',
};

const heights = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
};

export function Progress({ value, max = 100, variant = 'default', size = 'md', showLabel, className }: ProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full rounded-full bg-[var(--surface-1)] overflow-hidden', heights[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', colors[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-2xs text-[var(--text-tertiary)] mt-0.5 block text-right font-mono">{Math.round(pct)}%</span>
      )}
    </div>
  );
}
