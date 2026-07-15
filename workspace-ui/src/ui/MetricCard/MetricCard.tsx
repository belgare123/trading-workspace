
import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  delta?: { value: number; direction: 'up' | 'down' | 'neutral'; label?: string };
  variant?: 'default' | 'glass' | 'gradient';
  status?: 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-[var(--surface-1)] border-[var(--border-base)]',
  glass: 'bg-[rgba(11,14,20,0.6)] border-[var(--border-subtle)] backdrop-blur-[12px]',
  gradient: 'bg-gradient-to-br from-[var(--accent-blue-bg)] to-[rgba(46,189,122,0.05)] border-[var(--border-accent)]',
};

export function MetricCard({ icon, label, value, subtitle, delta, variant = 'glass', status = 'success', className, ...props }: MetricCardProps) {
  const deltaColor = delta
    ? delta.direction === 'up'
      ? 'text-[var(--accent-green)]'
      : delta.direction === 'down'
        ? 'text-[var(--accent-red)]'
        : 'text-[var(--text-tertiary)]'
    : '';

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all duration-150 hover:border-[var(--border-accent)]',
      variantStyles[variant],
      className,
    )} {...props}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="w-4 h-4 text-[var(--text-tertiary)]">{icon}</span>}
        <span className="text-2xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{value}</span>
        {delta && (
          <span className={cn('text-xs font-semibold', deltaColor)}>
            {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'} {delta.value}%
          </span>
        )}
      </div>
      {subtitle && <span className="text-2xs text-[var(--text-muted)]">{subtitle}</span>}
    </div>
  );
}
