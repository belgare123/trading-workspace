import type { ReactNode, HTMLAttributes } from 'react';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'danger';
  glow?: boolean;
}

export function GlassCard({ children, variant = 'default', glow, className, ...props }: GlassCardProps) {
  const cls = [
    'glass-card',
    variant !== 'default' ? variant : '',
    glow ? 'glow' : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}
