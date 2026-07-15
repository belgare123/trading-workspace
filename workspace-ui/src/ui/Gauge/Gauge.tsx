import type { HTMLAttributes } from 'react';
import { cn, clamp } from '../../lib/utils';

export interface GaugeProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  label?: string;
  variant?: 'success' | 'warning' | 'danger' | 'gradient';
  showValue?: boolean;
}

const colors = {
  success: { from: '#22c55e', to: '#4ade80' },
  warning: { from: '#eab308', to: '#facc15' },
  danger: { from: '#ef4444', to: '#f87171' },
  gradient: { from: '#3b82f6', to: '#22c55e' },
};

export function Gauge({
  value,
  max = 100,
  size = 80,
  thickness = 6,
  label,
  variant = 'gradient',
  showValue = true,
  className,
  ...props
}: GaugeProps) {
  const pct = clamp((value / max) * 100, 0, 100);
  const cx = size / 2;
  const r = cx - thickness - 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const c = colors[variant];

  return (
    <div className={cn('inline-flex flex-col items-center gap-1', className)} {...props}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
        <defs>
          <linearGradient id={`gauge-${variant}-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c.from} />
            <stop offset="100%" stopColor={c.to} />
          </linearGradient>
        </defs>
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={`url(#gauge-${variant}-${size})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {showValue && (
        <span className="text-lg font-bold text-[var(--text-primary)]">{Math.round(pct)}%</span>
      )}
      {label && (
        <span className="text-2xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      )}
    </div>
  );
}
