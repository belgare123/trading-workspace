import type { ReactNode } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import type { RuntimeStatus } from '../widgets/types'
import { Wifi, Cpu, HardDrive, Server } from 'lucide-react'

export interface StatusBarProps {
  left?: ReactNode
  center?: ReactNode
  right?: ReactNode
  status?: RuntimeStatus
}

export function StatusBar({ left, center, right, status = 'running' }: StatusBarProps) {
  return (
    <footer className="statusbar" role="status" aria-label="Application status">
      <div className="statusbar-left">
        {left || (
          <>
            <StatusBadge status={status} pulse />
            <span className="sep" />
            <Wifi size={12} strokeWidth={2} style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--success)' }}>Connected</span>
            <span className="sep" />
            <Server size={12} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
            <span>Backend OK</span>
          </>
        )}
      </div>
      {center && <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>{center}</div>}
      <div className="statusbar-right">
        {right || (
          <>
            <Cpu size={12} strokeWidth={1.5} />
            <span>CPU 2%</span>
            <span className="sep" />
            <HardDrive size={12} strokeWidth={1.5} />
            <span>MEM 1.2G</span>
            <span className="sep" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>v1.0.0</span>
          </>
        )}
      </div>
    </footer>
  )
}
