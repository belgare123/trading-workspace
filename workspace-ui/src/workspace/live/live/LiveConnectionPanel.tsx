/**
 * LiveConnectionPanel.tsx — Connection status & mode switching panel
 *
 * Shows the current execution mode (simulation / paper / live), connection
 * status, and provides connect/disconnect controls.
 *
 * @since 4.9
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { gatewayRuntime } from '../gateway/GatewayRuntime'
import { EXECUTION_MODE_LABELS, EXECUTION_MODE_COLORS } from '../gateway/ExecutionMode'
import type { ExecutionMode } from '../gateway/ExecutionMode'
import type { PanelContext } from '../../panels/PanelDefinition'

// ── Styles ──

const baseStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    gap: 12,
    height: '100%',
    overflow: 'auto',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: 'var(--muted, #888)',
  },
  value: {
    fontSize: 14,
    fontWeight: 500,
  },
  button: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  btnConnect: {
    backgroundColor: '#22c55e',
    color: '#fff',
  } as React.CSSProperties,
  btnDisconnect: {
    backgroundColor: '#ef4444',
    color: '#fff',
  } as React.CSSProperties,
  select: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border, #333)',
    fontSize: 13,
    backgroundColor: 'var(--surface, #1a1a2e)',
    color: 'inherit',
  },
}

function indicatorStyle(connected: boolean): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: connected ? '#22c55e' : '#ef4444',
    flexShrink: 0,
  }
}

function modeTagStyle(mode: ExecutionMode): React.CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: EXECUTION_MODE_COLORS[mode] ?? '#666',
  }
}

const MODE_OPTIONS: ExecutionMode[] = ['simulation', 'paper', 'live']

// ── Panel ──

export function LiveConnectionPanel(_ctx: PanelContext): ReactNode {
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState<ExecutionMode>('simulation')
  const [statusText, setStatusText] = useState('Initializing…')
  const [uptime, setUptime] = useState(0)

  // Poll status
  useEffect(() => {
    const interval = setInterval(() => {
      const status = gatewayRuntime.getStatus()
      if (status) {
        setConnected(status.connected)
        setMode(status.mode)
        setUptime(status.uptime)
        setStatusText(status.connected ? 'Connected' : 'Disconnected')
      }
    }, 2_000)
    return () => clearInterval(interval)
  }, [])

  const handleConnect = useCallback(async () => {
    try {
      setStatusText('Connecting…')
      await gatewayRuntime.init(mode)
      setConnected(true)
      setStatusText('Connected')
    } catch (err) {
      setStatusText(`Error: ${(err as Error).message}`)
    }
  }, [mode])

  const handleDisconnect = useCallback(async () => {
    try {
      await gatewayRuntime.shutdown()
      setConnected(false)
      setStatusText('Disconnected')
    } catch (err) {
      setStatusText(`Error: ${(err as Error).message}`)
    }
  }, [])

  const handleModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value as ExecutionMode)
  }, [])

  const fmtUptime = (s: number): string => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  return (
    <div style={baseStyles.container}>
      {/* Status */}
      <div style={baseStyles.statusRow}>
        <div style={indicatorStyle(connected)} />
        <span style={{
          ...baseStyles.value,
          color: connected ? '#22c55e' : '#ef4444',
        }}>
          {statusText}
        </span>
      </div>

      {/* Mode */}
      <div>
        <div style={baseStyles.label}>Execution Mode</div>
        <div style={baseStyles.statusRow}>
          {connected ? (
            <span style={modeTagStyle(mode)}>
              {EXECUTION_MODE_LABELS[mode] ?? mode}
            </span>
          ) : (
            <select
              style={baseStyles.select}
              value={mode}
              onChange={handleModeChange}
            >
              {MODE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {EXECUTION_MODE_LABELS[opt] ?? opt}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Uptime */}
      {connected && (
        <div>
          <div style={baseStyles.label}>Uptime</div>
          <div style={baseStyles.value}>{fmtUptime(uptime)}</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        {connected ? (
          <button
            style={{ ...baseStyles.button, ...baseStyles.btnDisconnect }}
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        ) : (
          <button
            style={{ ...baseStyles.button, ...baseStyles.btnConnect }}
            onClick={handleConnect}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}
