import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'flat';
}

export function Toolbar({ variant = 'glass', className, children, ...props }: ToolbarProps) {
  const base = 'flex items-center gap-2 px-4 py-2';
  const variants = {
    default: 'bg-[var(--surface-2)] border-b border-[var(--border-base)]',
    glass: 'bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.06)] backdrop-blur-[12px]',
    flat: 'border-b border-[var(--border-base)]',
  };
  return (
    <div className={cn(base, variants[variant], className)} {...props}>
      {children}
    </div>
  );
}

export function ToolbarGroup({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-1', className)} {...props}>
      {children}
    </div>
  );
}

export function ToolbarSpacer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1', className)} {...props} />;
}

export function ToolbarDivider({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-px h-5 bg-[var(--border-base)] mx-1', className)} {...props} />;
}
