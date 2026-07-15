import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useEvents } from '../../realtime'

// ── Types ───────────────────────────────────────────────────────────
interface RuntimeEvent {
  id: string
  type: string
  source: string
  level: 'info' | 'warn' | 'error' | 'debug'
  timestamp: number
  duration_ms?: number
  latency_ms?: number
  producer?: string
  consumers?: string[]
  payload: Record<string, unknown>
}

type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'debug'

// ── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:          '#0B0E14',
  card:        '#151922',
  cardHover:   '#1A1F2E',
  border:      '#1E2433',
  text:        '#E2E8F0',
  muted:       '#64748B',
  accent:      '#3B82F6',
  green:       '#22C55E',
  red:         '#EF4444',
  yellow:      '#EAB308',
  selectedBg:  '#1E293B',
  inputBg:     '#0F131A',
  treeKey:     '#818CF8',
  treeString:  '#22C55E',
  treeNumber:  '#F59E0B',
  treeBool:    '#3B82F6',
  treeNull:    '#64748B',
  treeBracket: '#64748B',
}

const LEVEL_COLORS: Record<string, string> = {
  info:  C.accent,
  warn:  C.yellow,
  error: C.red,
  debug: C.muted,
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' +
    String(d.getMilliseconds()).padStart(3, '0')
}

function getLevel(level: string): RuntimeEvent['level'] {
  if (['info', 'warn', 'error', 'debug'].includes(level)) return level as RuntimeEvent['level']
  return 'info'
}

// ── JSON Tree Viewer ─────────────────────────────────────────────────
function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span style={{ color: C.treeNull }}>null</span>
  if (typeof value === 'string')
    return <span style={{ color: C.treeString }}>"{value}"</span>
  if (typeof value === 'number')
    return <span style={{ color: C.treeNumber }}>{value}</span>
  if (typeof value === 'boolean')
    return <span style={{ color: C.treeBool }}>{String(value)}</span>
  if (Array.isArray(value))
    return <span style={{ color: C.treeBracket }}>[{value.length} items]</span>
  if (typeof value === 'object')
    return <span style={{ color: C.treeBracket }}>{'{' + Object.keys(value as Record<string, unknown>).length + ' keys}'}</span>
  return <span>{String(value)}</span>
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined || typeof data !== 'object') {
    return <div style={{ paddingLeft: depth * 16 }}><JsonValue value={data} /></div>
  }

  const entries = Array.isArray(data)
    ? data.map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>)

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <span style={{ color: C.treeBracket }}>
        {Array.isArray(data) ? '[' : '{'}
      </span>
      {entries.map(([key, val], i) => (
        <div key={key} style={{ display: 'flex', gap: 4, paddingLeft: 16 }}>
          <span style={{ color: C.treeKey }}>{key}:</span>
          {typeof val === 'object' && val !== null
            ? <JsonTree data={val} depth={depth + 1} />
            : <JsonValue value={val} />
          }
          {i < entries.length - 1 && <span style={{ color: C.muted }}>,</span>}
        </div>
      ))}
      <span style={{ color: C.treeBracket }}>
        {Array.isArray(data) ? ']' : '}'}
      </span>
    </div>
  )
}

// ── Event Inspector ──────────────────────────────────────────────────
export function EventInspector() {
  const { data: rawEvents, connectionState } = useEvents()
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [buffer, setBuffer] = useState<RuntimeEvent[]>([])
  const [paused, setPaused] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const MAX_EVENTS = 500

  // Buffer incoming events
  useEffect(() => {
    if (paused || !rawEvents) return

    const arr = Array.isArray(rawEvents) ? rawEvents : [rawEvents]
    const parsed: RuntimeEvent[] = arr.map((e, i) => {
      const rec = e as Record<string, unknown>
      return {
        id: String(rec.id ?? rec.event_id ?? `evt-${Date.now()}-${i}`),
        type: String(rec.type ?? rec.event_type ?? rec.name ?? 'unknown'),
        source: String(rec.source ?? rec.producer ?? rec.from ?? 'system'),
        level: getLevel(String(rec.level ?? rec.severity ?? 'info')),
        timestamp: Number(rec.timestamp ?? rec.ts ?? rec.time ?? Date.now()),
        duration_ms: rec.duration_ms as number | undefined,
        latency_ms: rec.latency_ms as number | undefined,
        producer: rec.producer as string | undefined,
        consumers: Array.isArray(rec.consumers) ? rec.consumers as string[] : undefined,
        payload: rec.payload as Record<string, unknown> ?? rec.data as Record<string, unknown> ?? rec,
      }
    })

    setBuffer(prev => {
      const next = [...parsed, ...prev]
      return next.slice(0, MAX_EVENTS)
    })
  }, [rawEvents, paused])

  // Auto-select latest event
  useEffect(() => {
    if (!selectedId && buffer.length > 0) {
      setSelectedId(buffer[0].id)
    }
  }, [buffer, selectedId])

  // Filter
  const filtered = useMemo(() => {
    let items = buffer
    if (levelFilter !== 'all') {
      items = items.filter(e => e.level === levelFilter)
    }
    if (filter.trim()) {
      const q = filter.toLowerCase()
      items = items.filter(e =>
        e.type.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      )
    }
    return items
  }, [buffer, filter, levelFilter])

  const selected = useMemo(
    () => filtered.find(e => e.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  )

  const handleClear = useCallback(() => {
    setBuffer([])
    setSelectedId(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 400 }}>
      {/* ── Left panel: event list ─────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 8,
        minWidth: 320, maxWidth: 480,
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 6,
            background: C.inputBg, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '4px 10px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by type, source..."
              style={{
                flex: 1, background: 'none', border: 'none',
                color: C.text, fontSize: 12, outline: 'none',
              }}
            />
          </div>

          {/* Level filter */}
          {(['all', 'info', 'warn', 'error', 'debug'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              style={{
                padding: '3px 10px', borderRadius: 4, border: 'none',
                fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
                background: levelFilter === l
                  ? (LEVEL_COLORS[l] || C.muted) + '33'
                  : C.card,
                color: levelFilter === l
                  ? (LEVEL_COLORS[l] || C.text)
                  : C.muted,
                cursor: 'pointer',
              }}
            >
              {l === 'all' ? 'ALL' : l}
            </button>
          ))}

          <button
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume' : 'Pause'}
            style={{
              padding: '4px 8px', borderRadius: 4, border: 'none',
              fontSize: 12, cursor: 'pointer',
              background: paused ? '#EAB30833' : C.card,
              color: paused ? C.yellow : C.muted,
            }}
          >
            {paused ? '▶' : '⏸'}
          </button>

          <button
            onClick={handleClear}
            style={{
              padding: '4px 8px', borderRadius: 4, border: 'none',
              fontSize: 12, cursor: 'pointer',
              background: C.card, color: C.muted,
            }}
          >
            ✕ Clear
          </button>

          <span style={{ fontSize: 11, color: C.muted }}>
            {connectionState === 'connected'
              ? <><span style={{ color: C.green }}>●</span> {filtered.length}</>
              : <><span style={{ color: C.yellow }}>◌</span> {connectionState}</>
            }
          </span>
        </div>

        {/* Event list */}
        <div ref={listRef} style={{
          flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
          gap: 1, background: C.bg, borderRadius: 6,
          border: `1px solid ${C.border}`,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              {buffer.length === 0
                ? 'Waiting for events...'
                : 'No matching events'}
            </div>
          ) : (
            filtered.map((evt) => (
              <button
                key={evt.id}
                onClick={() => setSelectedId(evt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', border: 'none', textAlign: 'left',
                  background: selectedId === evt.id ? C.selectedBg : 'transparent',
                  color: C.text, fontSize: 12, cursor: 'pointer',
                  borderBottom: `1px solid ${C.border}22`,
                  fontFamily: 'monospace',
                }}
              >
                {/* Level dot */}
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: LEVEL_COLORS[evt.level] || C.muted,
                }} />
                {/* Timestamp */}
                <span style={{ color: C.muted, flexShrink: 0, width: 90 }}>
                  {formatTime(evt.timestamp)}
                </span>
                {/* Source */}
                <span style={{
                  color: C.treeKey, flexShrink: 0, maxWidth: 120,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {evt.source}
                </span>
                {/* Event type */}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {evt.type}
                </span>
                {/* Duration badge */}
                {evt.duration_ms !== undefined && (
                  <span style={{
                    fontSize: 10, color: C.muted, flexShrink: 0,
                    background: C.inputBg, padding: '1px 5px', borderRadius: 3,
                  }}>
                    {evt.duration_ms.toFixed(1)}ms
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: event details ────────────────────────── */}
      <div style={{
        flex: 1.5, display: 'flex', flexDirection: 'column',
        background: C.card, borderRadius: 6, border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}>
        {!selected ? (
          <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Select an event to inspect
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: LEVEL_COLORS[selected.level],
                }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.type}</span>
                <span style={{ fontSize: 11, color: C.muted }}>— {selected.source}</span>
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>
                {formatTime(selected.timestamp)}
              </span>
            </div>

            {/* Details grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 16px',
              padding: '10px 14px', fontSize: 12,
              borderBottom: `1px solid ${C.border}`, background: C.inputBg,
            }}>
              <span style={{ color: C.muted }}>ID</span>
              <span style={{ fontFamily: 'monospace', color: C.text }}>{selected.id}</span>

              {selected.producer && (
                <>
                  <span style={{ color: C.muted }}>Producer</span>
                  <span style={{ color: C.treeKey }}>{selected.producer}</span>
                </>
              )}

              {selected.consumers && selected.consumers.length > 0 && (
                <>
                  <span style={{ color: C.muted }}>Consumers</span>
                  <span style={{ color: C.treeString }}>
                    {selected.consumers.join(', ')}
                  </span>
                </>
              )}

              {selected.duration_ms !== undefined && (
                <>
                  <span style={{ color: C.muted }}>Duration</span>
                  <span style={{ color: C.treeNumber }}>
                    {selected.duration_ms.toFixed(2)}ms
                  </span>
                </>
              )}

              {selected.latency_ms !== undefined && (
                <>
                  <span style={{ color: C.muted }}>Latency</span>
                  <span style={{
                    color: selected.latency_ms > 100 ? C.red : C.treeNumber,
                  }}>
                    {selected.latency_ms.toFixed(2)}ms
                  </span>
                </>
              )}
            </div>

            {/* Payload JSON viewer */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', fontSize: 12 }}>
              <div style={{ color: C.muted, marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
                Payload
              </div>
              <JsonTree data={selected.payload} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
