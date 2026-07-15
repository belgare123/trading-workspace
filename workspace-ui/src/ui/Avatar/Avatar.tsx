import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'glass' | 'gradient';
  status?: 'online' | 'away' | 'busy' | 'offline';
}

const sizeMap = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
};

const statusSize = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

const statusColor = {
  online: 'bg-[var(--accent-green)]',
  away: 'bg-[var(--accent-gold)]',
  busy: 'bg-[var(--accent-red)]',
  offline: 'bg-[var(--text-muted)]',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ src, name, size = 'md', variant = 'default', status, className, ...props }: AvatarProps) {
  const base = cn(
    'relative inline-flex items-center justify-center rounded-xl font-semibold flex-shrink-0',
    sizeMap[size],
    variant === 'default' && 'bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border-base)]',
    variant === 'glass' && 'bg-[rgba(255,255,255,0.04)] text-[var(--text-primary)] border border-[rgba(255,255,255,0.08)] backdrop-blur-[8px]',
    variant === 'gradient' && 'bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-green)] text-white shadow-md',
  );

  return (
    <div className={cn(base, className)} {...props}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-xl object-cover" />
      ) : (
        getInitials(name)
      )}
      {status && (
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[var(--surface-0)]',
          statusSize[size],
          statusColor[status],
        )} />
      )}
    </div>
  );
}
