
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
}

const variantStyles = {
  primary: 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] shadow-lg shadow-[var(--accent-blue)]/20',
  secondary: 'bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border-base)] hover:bg-[var(--surface-3)]',
  ghost: 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
  danger: 'bg-[var(--accent-red)] text-white hover:bg-[var(--accent-red-hover)]',
  glass: 'bg-[rgba(255,255,255,0.04)] text-[var(--text-primary)] border border-[rgba(255,255,255,0.08)] backdrop-blur-[12px] hover:bg-[rgba(255,255,255,0.08)]',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-2.5 text-base rounded-xl gap-2.5',
};

export function Button({ variant = 'primary', size = 'md', icon, loading, className, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50',
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && 'opacity-50 pointer-events-none',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

export function IconButton({ variant = 'ghost', size = 'md', icon, className, ...props }: ButtonProps) {
  const sizeMap = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-11 h-11' };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all duration-150',
        variantStyles[variant],
        sizeMap[size],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
