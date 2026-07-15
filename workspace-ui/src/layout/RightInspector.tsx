import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface InspectorProps {
  children: ReactNode;
  width?: number;
  title?: string;
  className?: string;
}

export function RightInspector({ children, width = 300, title, className }: InspectorProps) {
  return (
    <aside className={cn('flex flex-col h-full', className)} style={{ width }}>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-base)]">
          <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{title}</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  );
}

export interface DockProps {
  children: ReactNode;
  height?: number;
  className?: string;
}

export function BottomDock({ children, height = 48, className }: DockProps) {
  return (
    <div
      className={cn('flex items-center gap-4 px-4', className)}
      style={{ height, minHeight: height }}
    >
      {children}
    </div>
  );
}

export interface StatusBarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  height?: number;
  className?: string;
}

export function StatusBar({ left, center, right, height = 36, className }: StatusBarProps) {
  return (
    <footer
      className={cn('flex items-center px-4 text-xs', className)}
      style={{ height, minHeight: height }}
    >
      <div className="flex items-center gap-3 flex-1">{left}</div>
      {center && <div className="flex items-center gap-3">{center}</div>}
      <div className="flex items-center gap-3 ml-auto">{right}</div>
    </footer>
  );
}
