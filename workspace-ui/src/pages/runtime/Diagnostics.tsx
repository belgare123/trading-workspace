import { useState } from 'react'

const C = {
  bg: '#0B0E14', card: '#151922', border: '#1E2433',
  text: '#E2E8F0', muted: '#64748B', accent: '#3B82F6',
  green: '#22C55E', red: '#EF4444', yellow: '#EAB308',
  key: '#818CF8', input: '#0F131A',
}

// ── Plugin selector ──────────────────────────────────────────────────
const PLUGINS = ['Signal Engine', 'Heatmap', 'Telegram', 'OrderFlow', 'News Sentiment']

// ── Log entries ──────────────────────────────────────────────────────
const LOGS: Record<string, { time: string; level: string; msg: string }[]> = {
  'Signal Engine': [
    { time: '12:41:03', level: 'INFO',  msg: 'Signal Engine v2.1.0 loaded' },
    { time: '12:41:05', level: 'INFO',  msg: 'Connected to Event Bus' },
    { time: '12:41:08', level: 'INFO',  msg: 'Market subscription: BTC/USDT' },
    { time: '12:42:12', level: 'WARN',  msg: 'Reconnect attempt 2/5' },
    { time: '12:42:30', level: 'INFO',  msg: 'Reconnected successfully' },
    { time: '12:43:00', level: 'INFO',  msg: 'Health check passed' },
    { time: '12:44:33', level: 'ERROR', msg: 'SignalEngine: Timeout on RPC call' },
    { time: '12:44:35', level: 'WARN',  msg: 'SignalEngine: Retrying (3/5)' },
    { time: '12:45:01', level: 'INFO',  msg: 'SignalEngine: Retry succeeded' },
    { time: '12:46:22', level: 'WARN',  msg: 'Memory usage 78%' },
  ],
  'Heatmap': [
    { time: '12:40:00', level: 'INFO',  msg: 'Heatmap v1.3.4 loaded' },
    { time: '12:40:02', level: 'INFO',  msg: 'Widget registered: HeatmapWidget' },
    { time: '12:40:05', level: 'INFO',  msg: 'Connected to market stream' },
    { time: '12:41:00', level: 'INFO',  msg: 'Render cycle started' },
    { time: '12:45:12', level: 'WARN',  msg: 'Frame dropped (1)' },
    { time: '12:46:00', level: 'INFO',  msg: 'Render cycle completed' },
  ],
  'Telegram': [
    { time: '12:38:00', level: 'INFO',  msg: 'Telegram v1.0.2 loaded' },
    { time: '12:38:05', level: 'INFO',  msg: 'Telegram bot connected' },
    { time: '12:40:00', level: 'INFO',  msg: 'Message sent: #general' },
    { time: '12:42:00', level: 'INFO',  msg: 'Idle — no pending messages' },
  ],
  'OrderFlow': [
    { time: '12:30:00', level: 'INFO',  msg: 'OrderFlow v3.0.0 loaded' },
    { time: '12:30:10', level: 'INFO',  msg: 'Connected to exchange (Binance)' },
    { time: '12:31:00', level: 'WARN',  msg: 'High latency: 420ms' },
    { time: '12:32:00', level: 'ERROR', msg: 'Order rejected: INSUFFICIENT_BALANCE' },
    { time: '12:32:01', level: 'ERROR', msg: 'Plugin entered degraded mode' },
    { time: '12:33:00', level: 'ERROR', msg: 'Unhandled exception in confirm_trade()' },
    { time: '12:33:05', level: 'INFO',  msg: 'Auto-recovery triggered' },
  ],
  'News Sentiment': [
    { time: '12:39:00', level: 'INFO',  msg: 'News Sentiment v2.0.1 loaded' },
    { time: '12:39:02', level: 'INFO',  msg: 'Model loaded (distilbert-base)' },
    { time: '12:39:10', level: 'INFO',  msg: 'Scraping feed: news.google.com' },
    { time: '12:41:00', level: 'INFO',  msg: 'Sentiment update: BTC bullish' },
    { time: '12:44:00', level: 'INFO',  msg: 'Sentiment update: ETH neutral' },
  ],
}

// ── Performance data ─────────────────────────────────────────────────
const PERF: Record<string, { init: number; avgEvent: number; peak: number; memory: number }> = {
  'Signal Engine': { init: 42, avgEvent: 0.7, peak: 4.2, memory: 42 },
  'Heatmap':       { init: 28, avgEvent: 1.2, peak: 3.8, memory: 18 },
  'Telegram':      { init: 12, avgEvent: 0.3, peak: 1.1, memory: 8 },
  'OrderFlow':     { init: 56, avgEvent: 2.1, peak: 8.5, memory: 22 },
  'News Sentiment':{ init: 95, avgEvent: 1.8, peak: 5.2, memory: 28 },
}

const LEVEL_COLORS: Record<string, string> = { INFO: C.accent, WARN: C.yellow, ERROR: C.red }

// ── Diagnostics ──────────────────────────────────────────────────────
export function Diagnostics() {
  const [selected, setSelected] = useState<string>('Signal Engine')
  const logs = LOGS[selected] ?? []
  const perf = PERF[selected]

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 300 }}>
      {/* Left: plugin list */}
      <div style={{ flex: 1, maxWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {PLUGINS.map(p => (
          <button
            key={p}
            onClick={() => setSelected(p)}
            style={{
              padding: '6px 12px', border: 'none', textAlign: 'left',
              background: selected === p ? C.input : 'transparent',
              color: selected === p ? C.text : C.muted,
              fontSize: 12, cursor: 'pointer', borderRadius: 4,
              fontWeight: selected === p ? 600 : 400,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Right: log + perf */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Logs */}
        <div style={{
          flex: 2, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
          padding: 10, overflow: 'auto',
        }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Logs</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {logs.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                <span style={{ color: C.muted, flexShrink: 0 }}>{l.time}</span>
                <span style={{ color: LEVEL_COLORS[l.level] || C.text, fontWeight: 500, flexShrink: 0, width: 42 }}>
                  {l.level}
                </span>
                <span style={{ color: C.text }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance */}
        {perf && (
          <div style={{
            flex: 1, background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
            padding: 10,
          }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Metric label="Init" value={perf.init} unit="ms" color={perf.init > 50 ? C.yellow : C.green} />
              <Metric label="Avg Event" value={perf.avgEvent} unit="ms" color={perf.avgEvent > 1.5 ? C.yellow : C.green} />
              <Metric label="Peak" value={perf.peak} unit="ms" color={perf.peak > 5 ? C.red : C.green} />
              <Metric label="Memory" value={perf.memory} unit="MB" color={perf.memory > 30 ? C.yellow : C.green} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div style={{ padding: '6px 10px', background: C.input, borderRadius: 4, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color }}>
        {value}
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  )
}
