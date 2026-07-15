import type { ReactNode } from 'react';

export interface TopbarProps {
  logo?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}

export function Topbar({ logo, children, actions }: TopbarProps) {
  return (
    <header className="topbar">
      {logo && <div className="topbar-brand">{logo}</div>}
      {children && <nav className="topbar-nav">{children}</nav>}
      {actions && <div className="topbar-spacer" />}
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
