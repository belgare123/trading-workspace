/**
 * BacktestPanel.tsx — Thin React host for BacktestRuntime
 *
 * Thin wrapper that displays backtest sessions and their status.
 * No business logic — pure view layer.
 *
 * @since 3.7.2
 */

import { useRef, type ReactNode } from 'react'
import { BacktestRuntime } from '../../backtest/runtime/BacktestRuntime'

export interface BacktestPanelProps {
  /** Backtest runtime instance */
  runtime?: BacktestRuntime
}

/**
 * BacktestPanel — displays backtest sessions, status, controls.
 * Thin view layer over BacktestRuntime.
 */
export function BacktestPanel({ runtime }: BacktestPanelProps): ReactNode {
  const rt = useRef<BacktestRuntime>(runtime ?? new BacktestRuntime())
  const sessions = Array.from(rt.current.sessions.entries())

  return (
    <div style={{
      padding: 16,
      color: '#c9d1d9',
      fontFamily: 'monospace',
      fontSize: 13,
      height: '100%',
      background: '#0d1117',
      overflow: 'auto',
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#58a6ff' }}>
        Backtest Runtime
      </div>
      <div style={{ marginBottom: 8 }}>
        Sessions: <span style={{ color: '#d2a8ff' }}>{sessions.length}</span>
      </div>
      <div style={{ borderTop: '1px solid #21262d', margin: '12px 0' }} />
      {sessions.map(([id, session]) => (
        <div key={id} style={{ padding: '8px 0', borderBottom: '1px solid #21262d' }}>
          <div style={{ color: '#58a6ff', fontSize: 12 }}>{id}</div>
          <div style={{ color: '#8b949e', fontSize: 11 }}>
            Status: {session.state.status}
          </div>
        </div>
      ))}
      {sessions.length === 0 && (
        <div style={{ color: '#484f58', fontSize: 12, fontStyle: 'italic' }}>
          No sessions. Create one via StrategyPanel → Run Backtest.
        </div>
      )}
    </div>
  )
}
