import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export interface WorkspaceGridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  columns?: number;
  gap?: number;
  minChildWidth?: number;
}

export function WorkspaceGrid({ children, columns, gap = 4, minChildWidth, className, ...props }: WorkspaceGridProps) {
  const style: Record<string, string> = {};
  if (columns) style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  if (minChildWidth) style.gridTemplateColumns = `repeat(auto-fill, minmax(${minChildWidth}px, 1fr))`;

  return (
    <div
      className={cn('grid', className)}
      style={{ gap: `${gap * 4}px`, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PanelHostProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  fullscreen?: boolean;
}

export function PanelHost({ children, fullscreen, className, ...props }: PanelHostProps) {
  return (
    <div className={cn(
      'flex-1 overflow-auto',
      fullscreen ? 'absolute inset-0 z-40' : 'relative',
      className,
    )} {...props}>
      {children}
    </div>
  );
}

export function WorkspaceRow({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex gap-4', className)} {...props}>{children}</div>;
}

export function WorkspaceCol({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-4', className)} {...props}>{children}</div>;
}
