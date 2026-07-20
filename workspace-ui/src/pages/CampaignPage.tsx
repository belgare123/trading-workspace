/**
 * CampaignPage.tsx — Paper Campaign status dashboard
 *
 * Displays real-time status of the running Paper Campaign:
 *   - Current stage (Burn-in / Campaign / Failed)
 *   - Uptime
 *   - Reconnect count
 *   - Memory / CPU (from daemon)
 *   - Certification Suite results
 *   - Incident log
 *
 * Data source: reads from /tmp/paper-campaign-health.json (written by healthcheck.ts)
 *              and /tmp/paper-campaign-state.json (written by daemon if available).
 *
 * @since 4.9
 */

import { useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

// ── Types ──

interface HealthState {
  timestamp: string
  campaignAlive: boolean
  campaignMemoryMB: number | null
  wsPingOk: boolean | null
  overall: 'healthy' | 'degraded' | 'critical' | 'unknown'
  message: string
}

interface CampaignState {
  stage: string
  uptime: string
  reconnectCount: number
  exceptionsCount: number
  lastCertResult: string
  lastCertTimestamp: string
  incidents: Array<{
    id: string
    type: string
    message: string
    severity: string
    timestamp: string
  }>
  memoryMB: number | null
}

// ── Helpers ──

function fetchHealth(): Promise<HealthState | null> {
  return fetch('/api/campaign/health')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
}

function fetchCampaignState(): Promise<CampaignState | null> {
  return fetch('/api/campaign/state')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
}

// ── Components ──

function StatusBadge({ status, label }: { status: string; label: string }): ReactNode {
  const colors: Record<string, { bg: string; fg: string; dot: string }> = {
    healthy: { bg: '#0a2e1a', fg: '#4ade80', dot: '#22c55e' },
    degraded: { bg: '#2e1a0a', fg: '#fbbf24', dot: '#eab308' },
    critical: { bg: '#2e0a0a', fg: '#f87171', dot: '#ef4444' },
    'burn-in': { bg: '#0a1a2e', fg: '#60a5fa', dot: '#3b82f6' },
    'paper-campaign': { bg: '#1a0a2e', fg: '#a78bfa', dot: '#8b5cf6' },
    completed: { bg: '#0a2e1a', fg: '#4ade80', dot: '#22c55e' },
    failed: { bg: '#2e0a0a', fg: '#f87171', dot: '#ef4444' },
  }
  const style = colors[status] ?? colors.healthy

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '12px',
        background: style.bg,
        color: style.fg,
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'monospace',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }): ReactNode {
  return (
    <div
      style={{
        background: 'var(--bg-card, #1a1a2e)',
        border: '1px solid var(--border-color, #2a2a4a)',
        borderRadius: '8px',
        padding: '16px',
        minWidth: '140px',
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace' }}>
        {value}
        {unit && <span style={{ fontSize: '13px', color: 'var(--text-muted, #888)', marginLeft: '4px' }}>{unit}</span>}
      </div>
    </div>
  )
}

// ── Incident Icon ──

function IncidentIcon({ severity }: { severity: string }): string {
  switch (severity) {
    case 'critical': return '🔴'
    case 'warning': return '🟡'
    default: return '🔵'
  }
}

// ── Main Page ──

export function CampaignPage(): ReactNode {
  const [health, setHealth] = useState<HealthState | null>(null)
  const [state, setState] = useState<CampaignState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    Promise.all([fetchHealth(), fetchCampaignState()])
      .then(([h, s]) => {
        setHealth(h)
        setState(s)
        setError(null)
      })
      .catch(() => setError('Failed to load campaign status'))
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10_000) // Poll every 10s
    return () => clearInterval(interval)
  }, [refresh])

  // ── Derive health status string ──
  const stage = state?.stage ?? 'unknown'
  const healthStatus = health?.overall ?? 'unknown'
  const uptime = state?.uptime ?? (health?.campaignAlive ? 'alive' : 'offline')

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <span style={{ fontSize: '28px' }}>📋</span>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Paper Campaign</h1>
        <StatusBadge status={stage} label={stage === 'burn-in' ? 'Burn-in' : stage === 'paper-campaign' ? 'Campaign' : stage === 'completed' ? 'Completed' : stage === 'failed' ? 'Failed' : stage} />
        <StatusBadge status={healthStatus} label={healthStatus} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#2e0a0a',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#f87171',
          marginBottom: '16px',
          fontSize: '13px',
        }}>
          ⚠ {error}
          <button onClick={refresh} style={{ marginLeft: '12px', cursor: 'pointer', background: 'none', border: '1px solid #ef4444', color: '#f87171', borderRadius: '4px', padding: '2px 8px', fontSize: '12px' }}>
            Retry
          </button>
        </div>
      )}

      {/* Status cards */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard label="Uptime" value={uptime} />
        <StatCard label="Memory" value={health?.campaignMemoryMB != null ? `${health.campaignMemoryMB}` : state?.memoryMB != null ? `${state.memoryMB}` : '?'} unit="MB" />
        <StatCard label="Reconnects" value={state?.reconnectCount ?? '0'} />
        <StatCard label="Exceptions" value={state?.exceptionsCount ?? '0'} />
        <StatCard label="Certification" value={state?.lastCertResult ?? 'N/A'} />
        <StatCard label="WebSocket" value={health?.wsPingOk ? '✅' : health?.wsPingOk === false ? '❌' : '?'} />
      </div>

      {/* Certification History */}
      <div
        style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>📊 Certification Suite</h2>
        <div style={{ fontSize: '13px', color: 'var(--text-muted, #888)' }}>
          {state?.lastCertTimestamp ? (
            <>Last run: {new Date(state.lastCertTimestamp).toLocaleString()}</>
          ) : (
            'Waiting for first run...'
          )}
        </div>
        {state?.lastCertResult && state.lastCertResult !== 'N/A' && (
          <div style={{ marginTop: '8px', fontSize: '14px' }}>
            Score: <strong style={{ fontFamily: 'monospace', fontSize: '18px' }}>{state.lastCertResult}</strong>
          </div>
        )}
      </div>

      {/* Incidents */}
      <div
        style={{
          background: 'var(--bg-card, #1a1a2e)',
          border: '1px solid var(--border-color, #2a2a4a)',
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>📋 Incidents</h2>
        {state?.incidents && state.incidents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {state.incidents.slice(-20).reverse().map((inc) => (
              <div
                key={inc.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: inc.severity === 'critical' ? '#2e0a0a33' : inc.severity === 'warning' ? '#2e1a0a33' : 'transparent',
                  fontSize: '13px',
                  borderLeft: `3px solid ${inc.severity === 'critical' ? '#ef4444' : inc.severity === 'warning' ? '#fbbf24' : '#60a5fa'}`,
                }}
              >
                <span>{IncidentIcon(inc.severity)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary, #ccc)' }}>{inc.message}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginTop: '2px' }}>
                    {inc.type} · {new Date(inc.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-muted, #888)' }}>
            No incidents recorded
          </div>
        )}
      </div>
    </div>
  )
}

export default CampaignPage
