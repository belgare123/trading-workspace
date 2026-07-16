/**
 * LiveWorkspace.tsx — Live Trading workspace page
 *
 * Renders all 6 Live Trading panels in a 2-column + bottom grid layout:
 *
 *   ┌──────────┬──────────────────────────────┐
 *   │Connection│         Orders               │
 *   │          │                              │
 *   ├──────────┤                              │
 *   │ Account  │                              │
 *   │          ├──────────────────────────────┤
 *   ├──────────┤         Positions            │
 *   │  Risk    │                              │
 *   │          │                              │
 *   ├──────────┴──────────────────────────────┤
 *   │              History/Journal            │
 *   └─────────────────────────────────────────┘
 *
 * @since 4.8
 */

import { type ReactNode } from 'react'
import { LiveConnectionPanel } from '../../workspace/live/live/LiveConnectionPanel'
import { LiveOrdersPanel } from '../../workspace/live/live/LiveOrdersPanel'
import { LivePositionsPanel } from '../../workspace/live/live/LivePositionsPanel'
import { LiveAccountPanel } from '../../workspace/live/live/LiveAccountPanel'
import { LiveRiskPanel } from '../../workspace/live/live/LiveRiskPanel'
import { LiveHistoryPanel } from '../../workspace/live/live/LiveHistoryPanel'

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--surface, #0f0f1a)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px',
    gap: 8,
    borderBottom: '1px solid var(--border, #1e1e2e)',
    backgroundColor: 'var(--surface-alt, #14142a)',
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text, #eee)',
    letterSpacing: '0.3px',
  },
  subtitle: {
    fontSize: 11,
    color: 'var(--muted, #888)',
    marginLeft: 8,
  },
  grid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    gridTemplateRows: '1fr 1fr auto',
    gap: 1,
    backgroundColor: 'var(--border, #1e1e2e)',
    overflow: 'hidden',
  } as React.CSSProperties,
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    backgroundColor: 'var(--border, #1e1e2e)',
  } as React.CSSProperties,
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    backgroundColor: 'var(--border, #1e1e2e)',
  } as React.CSSProperties,
  panel: {
    backgroundColor: 'var(--surface, #1a1a2e)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--muted, #888)',
    borderBottom: '1px solid var(--border, #222)',
    letterSpacing: '0.5px',
    backgroundColor: 'var(--surface-alt, #14142a)',
  } as React.CSSProperties,
  panelBody: {
    flex: 1,
    overflow: 'auto',
  } as React.CSSProperties,
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 16px',
    fontSize: 11,
    color: 'var(--muted, #666)',
    borderTop: '1px solid var(--border, #1e1e2e)',
    backgroundColor: 'var(--surface-alt, #14142a)',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  } as React.CSSProperties,
}

// ── Panel Wrapper ──

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>{title}</div>
      <div style={styles.panelBody}>{children}</div>
    </div>
  )
}

// ── LiveWorkspace Page ──

export function LiveWorkspace(): ReactNode {
  return (
    <div style={styles.page}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.title}>Live Trading</span>
        <span style={styles.subtitle}>Mock Broker · Paper Mode</span>
      </div>

      {/* Main Grid */}
      <div style={styles.grid}>
        {/* Left column — Connection + Account + Risk */}
        <div style={{ ...styles.leftCol, gridRow: '1 / 3' }}>
          <PanelSection title="Connection">
            <LiveConnectionPanel />
          </PanelSection>
          <PanelSection title="Account">
            <LiveAccountPanel />
          </PanelSection>
          <PanelSection title="Risk">
            <LiveRiskPanel />
          </PanelSection>
        </div>

        {/* Right column top — Orders + Positions split */}
        <div style={{ ...styles.rightCol, gridRow: '1 / 3' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <PanelSection title="Orders">
              <LiveOrdersPanel />
            </PanelSection>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <PanelSection title="Positions">
              <LivePositionsPanel />
            </PanelSection>
          </div>
        </div>

        {/* Bottom — History spans full width */}
        <div style={{ gridColumn: '1 / 3' }}>
          <PanelSection title="History / Journal">
            <LiveHistoryPanel />
          </PanelSection>
        </div>
      </div>

      {/* Status bar */}
      <div style={styles.bottomBar}>
        <div style={styles.statusIndicator}>
          <div style={styles.dot} />
          <span>Disconnected</span>
        </div>
        <span>Strategy: idle</span>
      </div>
    </div>
  )
}
