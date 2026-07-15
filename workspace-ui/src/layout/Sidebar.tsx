import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react';

export interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return <aside className="sidebar">{children}</aside>;
}

export function SidebarSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      {label && (
        <div className="px-3 py-2">
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export function SidebarItem({ icon, label, active, badge, className, ...props }: {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
  className?: string;
} & HTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer${
        active
          ? ' bg-[rgba(59,130,246,0.12)] text-[var(--primary)]'
          : ' text-[var(--text-sec)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text)]'
      }${className ? ` ${className}` : ''}`}
      {...props}
    >
      {icon && <span className="shrink-0 w-4 h-4" style={{ opacity: 0.7 }}>{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'var(--raised)', color: 'var(--text-muted)', fontWeight: 500 }}>
          {badge}
        </span>
      )}
    </a>
  );
}

export interface SidebarBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label: string;
  active?: boolean;
}

export function SidebarBtn({ icon, label, active, className, ...props }: SidebarBtnProps) {
  return (
    <button
      className={`sidebar-btn${active ? ' active' : ''}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
      {...props}
    >
      {icon}
    </button>
  );
}
