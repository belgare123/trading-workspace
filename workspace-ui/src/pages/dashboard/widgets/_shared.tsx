import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface WidgetHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function WidgetHeader({ title, subtitle, icon, action, className }: WidgetHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          {subtitle && <span className="text-2xs text-[var(--text-muted)]">{subtitle}</span>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export { WidgetGrid, WidgetCell } from '../DashboardGrid';
