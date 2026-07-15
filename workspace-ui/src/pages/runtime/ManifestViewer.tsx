import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Sample manifests ─────────────────────────────────────────────────
const MANIFESTS = {
  'plugin.json': `{
  "id": "signal-engine",
  "name": "Signal Engine",
  "version": "2.1.0",
  "type": "strategy",
  "entry": "main.py",
  "author": "Core Team",
  "license": "MIT",
  "description": "Advanced signal generation engine with multi-timeframe analysis",
  "capabilities": [
    "market.read",
    "event.read",
    "order.create"
  ],
  "dependencies": {
    "runtime": ">=1.2.0",
    "market-api": ">=2.0.0",
    "event-store": ">=1.5.0"
  },
  "services": ["SignalBus"],
  "widgets": ["SignalChartWidget"],
  "commands": [
    "strategy.start",
    "strategy.stop",
    "strategy.config"
  ],
  "events": [
    "signal.created",
    "signal.updated",
    "signal.expired"
  ],
  "sandbox": {
    "cpu_limit": 50,
    "memory_limit": "256MB",
    "network": "isolated"
  },
  "permissions": {
    "critical": ["market.read", "order.create"],
    "optional": ["notification.send"]
  }
}`,
  'manifest.yaml': `id: heatmap
name: Heatmap
version: 1.3.4
type: widget
entry: index.js
author: Community

capabilities:
  - market.read
  - widget.register

dependencies:
  runtime: ">=1.2.0"
  market-service: ">=2.0.0"

widgets:
  - HeatmapWidget

commands:
  - heatmap.toggle
  - heatmap.config

events:
  - render.frame
  - heatmap.updated

sandbox:
  cpu_limit: 30
  memory_limit: 128MB
`,
}

// ── Syntax highlight (simple) ────────────────────────────────────────
function highlightLine(line: string, idx: number): JSX.Element {
  // JSON keys
  const keyMatch = line.match(/^(\s*)"(.+?)"\s*:/)
  if (keyMatch) {
    return (
      <span key={idx}>
        <span style={{ color: C.muted }}>{keyMatch[1]}</span>
        <span style={{ color: C.key }}>"{keyMatch[2]}"</span>
        <span style={{ color: C.text }}>{line.slice(keyMatch[0].length)}</span>
        {'\n'}
      </span>
    )
  }

  // YAML keys
  const yamlKey = line.match(/^(\s*)([\w-]+):/)
  if (yamlKey) {
    return (
      <span key={idx}>
        <span style={{ color: C.muted }}>{yamlKey[1]}</span>
        <span style={{ color: C.key }}>{yamlKey[2]}</span>
        <span style={{ color: C.text }}>{line.slice(yamlKey[0].length)}</span>
        {'\n'}
      </span>
    )
  }

  // Boolean / null
  const boolLine = line.replace(/(true|false|null)/g, (m) => `__BOOL__${m}__BOOL__`)
  if (boolLine !== line) {
    const parts = boolLine.split(/__BOOL__(.+?)__BOOL__/).filter(Boolean)
    return (
      <span key={idx}>
        {parts.map((p, j) => {
          if (p === 'true' || p === 'false') return <span key={j} style={{ color: C.yellow }}>{p}</span>
          if (p === 'null') return <span key={j} style={{ color: C.red }}>{p}</span>
          return <span key={j} style={{ color: C.text }}>{p}</span>
        })}
        {'\n'}
      </span>
    )
  }

  return <span key={idx} style={{ color: C.text }}>{line}{'\n'}</span>
}

// ── ManifestViewer ───────────────────────────────────────────────────
export function ManifestViewer() {
  const [file, setFile] = useState<'plugin.json' | 'manifest.yaml'>('plugin.json')
  const content = MANIFESTS[file]
  const lines = content.split('\n')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* File tabs */}
      <div style={{ display: 'flex', gap: 2 }}>
        {(['plugin.json', 'manifest.yaml'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFile(f)}
            style={{
              padding: '5px 14px', border: 'none',
              background: file === f ? C.input : 'transparent',
              color: file === f ? C.accent : C.muted,
              fontSize: 12, fontFamily: 'monospace', cursor: 'pointer',
              borderBottom: file === f ? `2px solid ${C.accent}` : '2px solid transparent',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Viewer */}
      <div style={{
        flex: 1, background: '#060A10', borderRadius: 6, border: `1px solid ${C.border}`,
        padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Line numbers */}
          <div style={{ color: C.muted, textAlign: 'right', userSelect: 'none', opacity: 0.5 }}>
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Code */}
          <div>
            {lines.map((line, i) => highlightLine(line, i))}
          </div>
        </div>
      </div>
    </div>
  )
}
