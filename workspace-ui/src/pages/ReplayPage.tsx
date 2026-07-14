import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardHeader } from '../components/ui'
import { getSessions, loadSession, getReplayState, controlReplay } from '../api/replay'
import type { PlaybackEvent, PlaybackState } from '../types'

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8]

const EVENT_COLORS: Record<string, string> = {
  session_start: 'text-surface-500',
  session_end: 'text-surface-500',
  market_data: 'text-blue-400',
  feature_update: 'text-emerald-400',
  context_update: 'text-violet-400',
  signal: 'text-amber-400',
  decision: 'text-orange-400',
  opportunity: 'text-cyan-400',
  trade_open: 'text-green-400',
  trade_update: 'text-teal-400',
  trade_close: 'text-red-400',
}

const EVENT_BADGES: Record<string, { label: string; color: string }> = {
  session_start: { label: 'START', color: 'bg-surface-700 text-surface-300' },
  session_end: { label: 'END', color: 'bg-surface-700 text-surface-300' },
  market_data: { label: 'DATA', color: 'bg-blue-900/40 text-blue-300' },
  feature_update: { label: 'FEATURE', color: 'bg-emerald-900/40 text-emerald-300' },
  context_update: { label: 'CONTEXT', color: 'bg-violet-900/40 text-violet-300' },
  signal: { label: 'SIGNAL', color: 'bg-amber-900/40 text-amber-300' },
  decision: { label: 'DECIDE', color: 'bg-orange-900/40 text-orange-300' },
  opportunity: { label: 'OPPORTUNITY', color: 'bg-cyan-900/40 text-cyan-300' },
  trade_open: { label: 'BUY', color: 'bg-green-900/40 text-green-300' },
  trade_update: { label: 'UPDATE', color: 'bg-teal-900/40 text-teal-300' },
  trade_close: { label: 'SELL', color: 'bg-red-900/40 text-red-300' },
}

const EVENT_ICONS: Record<string, string> = {
  session_start: '●',
  session_end: '■',
  market_data: '📊',
  feature_update: '📐',
  context_update: '🧠',
  signal: '⚡',
  decision: '🎯',
  opportunity: '💎',
  trade_open: '🟢',
  trade_update: '🔄',
  trade_close: '🔴',
}

export function ReplayPage() {
  const [selectedSession, setSelectedSession] = useState('')
  const [speed, setSpeed] = useState(1)
  const [currentStep, setCurrentStep] = useState(0)
  const [status, setStatus] = useState<'stopped' | 'paused' | 'playing'>('stopped')
  const [events, setEvents] = useState<PlaybackEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<PlaybackEvent | null>(null)
  const [log, setLog] = useState<PlaybackEvent[]>([])
  const timelineRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: sessions = [] } = useQuery({
    queryKey: ['replay-sessions'],
    queryFn: getSessions,
  })

  const loadMutation = useMutation({
    mutationFn: (sessionId: string) => loadSession(sessionId),
    onSuccess: (data) => {
      setStatus(data.status as PlaybackState['status'])
      setCurrentStep(0)
      setSelectedEvent(null)
      setLog([])
    },
  })

  const controlMutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: Record<string, unknown> }) =>
      controlReplay(action, payload),
    onSuccess: () => {
      refreshState()
    },
  })

  const refreshState = useCallback(async () => {
    try {
      const state = await getReplayState()
      setStatus(state.status)
      setCurrentStep(state.current_step)
      setEvents(state.events)
    } catch {}
  }, [])

  // Initialize default session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0].id)
      loadMutation.mutate(sessions[0].id)
    }
  }, [sessions])

  // Auto-play timer
  useEffect(() => {
    if (status === 'playing' && events.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          const next = prev + 1
          if (next > events.length) {
            setStatus('paused')
            return prev
          }
          // Add to log
          const evt = events.find((e) => e.step === next)
          if (evt) {
            setLog((prevLog) => [...prevLog.slice(-99), evt])
            setSelectedEvent(evt)
          }
          return next
        })
      }, Math.max(200, 1000 / speed))
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status, speed, events])

  const handlePlay = () => {
    controlMutation.mutate({ action: 'play' })
    setStatus('playing')
  }

  const handlePause = () => {
    controlMutation.mutate({ action: 'pause' })
    setStatus('paused')
  }

  const handleStop = () => {
    controlMutation.mutate({ action: 'stop' })
    setStatus('stopped')
    setCurrentStep(0)
    setSelectedEvent(null)
    setLog([])
  }

  const handleSeek = (step: number) => {
    controlMutation.mutate({ action: 'seek', payload: { step } })
    setCurrentStep(step)
    const evt = events.find((e) => e.step === step)
    if (evt) setSelectedEvent(evt)
  }

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    controlMutation.mutate({ action: 'speed', payload: { speed: newSpeed } })
  }

  const handleSessionChange = (sessionId: string) => {
    setSelectedSession(sessionId)
    loadMutation.mutate(sessionId)
  }

  const handleEventClick = (evt: PlaybackEvent) => {
    setSelectedEvent(evt)
    handleSeek(evt.step)
  }

  const currentEvent = events.find((e) => e.step === currentStep)
  const totalEvents = events.length
  const timelinePercent = totalEvents > 0 ? (currentStep / totalEvents) * 100 : 0

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Top Bar: Session + Transport ── */}
      <div className="flex items-center justify-between bg-surface-850 rounded-lg border border-surface-700/50 p-2">
        <div className="flex items-center gap-3">
          <select
            value={selectedSession}
            onChange={(e) => handleSessionChange(e.target.value)}
            className="bg-surface-800 text-surface-50 border border-surface-600 rounded-md px-3 py-1.5 text-sm font-mono"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePlay}
              disabled={status === 'playing'}
              className="px-3 py-1.5 rounded-md bg-green-700/30 text-green-300 text-sm hover:bg-green-700/50 disabled:opacity-30 transition-colors"
              title="Play"
            >
              ▶
            </button>
            <button
              onClick={handlePause}
              disabled={status !== 'playing'}
              className="px-3 py-1.5 rounded-md bg-amber-700/30 text-amber-300 text-sm hover:bg-amber-700/50 disabled:opacity-30 transition-colors"
              title="Pause"
            >
              ⏸
            </button>
            <button
              onClick={handleStop}
              disabled={status === 'stopped'}
              className="px-3 py-1.5 rounded-md bg-red-700/30 text-red-300 text-sm hover:bg-red-700/50 disabled:opacity-30 transition-colors"
              title="Stop"
            >
              ⏹
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-1 rounded font-mono transition-colors ${
                  speed === s
                    ? 'bg-surface-600 text-surface-50'
                    : 'text-surface-500 hover:text-surface-300'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-surface-600">
          <span>
            Step <span className="font-mono text-surface-300">{currentStep}</span> /{' '}
            <span className="font-mono text-surface-400">{totalEvents}</span>
          </span>
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status === 'playing'
                ? 'bg-green-400 animate-pulse'
                : status === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-surface-600'
            }`}
          />
          <span className="capitalize text-surface-400">{status}</span>
        </div>
      </div>

      {/* ── Seek Bar ── */}
      <div className="flex items-center gap-3 px-1">
        <input
          type="range"
          min={0}
          max={totalEvents || 1}
          value={currentStep}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="flex-1 h-1.5 appearance-none bg-surface-700 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400
            [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span className="text-xs font-mono text-surface-500 w-16 text-right">
          {currentStep > 0 && currentEvent
            ? new Date(currentEvent.timestamp * 1000).toLocaleTimeString()
            : '--:--:--'}
        </span>
      </div>

      {/* ── Main Content: 3 panels ── */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: Event List */}
        <div className="w-64 shrink-0 overflow-y-auto rounded-lg border border-surface-700/50 bg-surface-850">
          <div className="sticky top-0 bg-surface-850 z-10 px-3 py-2 border-b border-surface-700/50">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Events
            </span>
            <span className="text-xs text-surface-600 ml-2">{totalEvents}</span>
          </div>
          <div className="divide-y divide-surface-700/30">
            {events.map((evt) => {
              const isActive = evt.step === currentStep
              const isSelected = evt.id === selectedEvent?.id
              const color = EVENT_COLORS[evt.type] || 'text-surface-400'
              const icon = EVENT_ICONS[evt.type] || '●'
              const badge = EVENT_BADGES[evt.type]
              return (
                <button
                  key={evt.id}
                  onClick={() => handleEventClick(evt)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    isActive
                      ? 'bg-blue-900/20 border-l-2 border-blue-400'
                      : isSelected
                        ? 'bg-surface-700/30'
                        : 'hover:bg-surface-700/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${color}`}>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${color} truncate`}>
                          {evt.type.replace('_', ' ')}
                        </span>
                        {badge && (
                          <span className={`px-1 py-0.5 rounded text-[10px] font-mono ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-surface-600 font-mono mt-0.5">
                        step {evt.step} · {new Date(evt.timestamp * 1000).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Center: Timeline + Playback Log */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Timeline Visualization */}
          <Card className="shrink-0">
            <CardHeader>
              <span className="text-sm font-semibold text-surface-50">Timeline</span>
              <div className="flex items-center gap-2 text-[10px] text-surface-600">
                {Object.entries(EVENT_ICONS).map(([type, icon]) => (
                  <span key={type} className="flex items-center gap-1">
                    <span>{icon}</span>
                    <span>{type.replace('_', ' ')}</span>
                  </span>
                ))}
              </div>
            </CardHeader>
            <div ref={timelineRef} className="px-2 pb-4">
              <svg width="100%" height={60} className="overflow-visible">
                {/* Background track */}
                <line
                  x1="0"
                  y1="30"
                  x2="100%"
                  y2="30"
                  stroke="rgba(148,163,184,0.15)"
                  strokeWidth={2}
                />
                {/* Event dots */}
                {events.map((evt) => {
                  const x = totalEvents > 1 ? (evt.step / totalEvents) * 100 : 50
                  const isActive = evt.step === currentStep
                  const colorMap: Record<string, string> = {
                    session_start: '#64748b',
                    session_end: '#64748b',
                    market_data: '#60a5fa',
                    feature_update: '#34d399',
                    context_update: '#a78bfa',
                    signal: '#fbbf24',
                    decision: '#fb923c',
                    opportunity: '#22d3ee',
                    trade_open: '#4ade80',
                    trade_update: '#2dd4bf',
                    trade_close: '#f87171',
                  }
                  const color = colorMap[evt.type] || '#64748b'
                  const r = isActive ? 6 : 3
                  return (
                    <g key={evt.id}>
                      <circle
                        cx={`${x}%`}
                        cy={30}
                        r={r}
                        fill={color}
                        opacity={isActive ? 1 : 0.6}
                        stroke={isActive ? '#fff' : 'none'}
                        strokeWidth={isActive ? 1.5 : 0}
                      />
                    </g>
                  )
                })}
                {/* Seek position line */}
                {currentStep > 0 && (
                  <line
                    x1={`${timelinePercent}%`}
                    y1={5}
                    x2={`${timelinePercent}%`}
                    y2={55}
                    stroke="rgba(96, 165, 250, 0.6)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                  />
                )}
                {/* Seek handle */}
                <circle
                  cx={`${timelinePercent}%`}
                  cy={30}
                  r={8}
                  fill="rgba(96, 165, 250, 0.3)"
                  stroke="rgba(96, 165, 250, 0.8)"
                  strokeWidth={2}
                />
              </svg>
            </div>
          </Card>

          {/* Playback Log */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader>
              <span className="text-sm font-semibold text-surface-50">Playback Log</span>
              <span className="text-xs text-surface-600">{log.length} events</span>
            </CardHeader>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
              {log.length === 0 ? (
                <div className="text-surface-600 text-sm py-8 text-center">
                  Press ▶ to start playback
                </div>
              ) : (
                [...log].reverse().map((evt, i) => (
                  <div
                    key={`${evt.step}-${i}`}
                    onClick={() => handleEventClick(evt)}
                    className={`flex items-center gap-3 py-1.5 px-2 rounded cursor-pointer text-xs ${
                      evt.step === currentStep
                        ? 'bg-blue-900/20'
                        : 'hover:bg-surface-700/20'
                    }`}
                  >
                    <span className={`w-16 shrink-0 font-mono text-surface-600`}>
                      step {evt.step}
                    </span>
                    <span className={`font-mono ${EVENT_COLORS[evt.type] || 'text-surface-400'} w-10`}>
                      {evt.type.replace('_', ' ')}
                    </span>
                    <span className="text-surface-300 font-medium">
                      {formatEventSummary(evt)}
                    </span>
                    <span className="ml-auto text-surface-600 font-mono">
                      {new Date(evt.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right: Event Inspector */}
        <div className="w-80 shrink-0 overflow-y-auto rounded-lg border border-surface-700/50 bg-surface-850">
          <div className="sticky top-0 bg-surface-850 z-10 px-3 py-2 border-b border-surface-700/50">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Event Inspector
            </span>
          </div>
          {selectedEvent ? (
            <div className="p-3 space-y-3">
              {/* Event header */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${EVENT_COLORS[selectedEvent.type]}`}>
                    {EVENT_ICONS[selectedEvent.type] || '●'}
                  </span>
                  <span className={`text-sm font-semibold ${EVENT_COLORS[selectedEvent.type]}`}>
                    {selectedEvent.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-surface-600">
                  <span>Step: {selectedEvent.step}</span>
                  <span className="truncate">ID: {selectedEvent.id}</span>
                  <span>Symbol: {selectedEvent.symbol}</span>
                  <span>
                    Time:{' '}
                    {new Date(selectedEvent.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Event payload */}
              <div>
                <div className="text-[10px] font-semibold text-surface-600 uppercase tracking-wider mb-1.5">
                  Payload
                </div>
                <div className="space-y-1">
                  {Object.entries(selectedEvent.data).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2 text-xs">
                      <span className="text-surface-600 font-mono shrink-0 w-24 text-right">
                        {key}
                      </span>
                      <span className="text-surface-300 font-mono break-all">
                        {formatPayloadValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Open in Inspector link */}
              <button
                onClick={() => {
                  /* Future: navigate to Inspector with this symbol */
                }}
                className="w-full text-center py-2 rounded-md bg-surface-700/50 text-surface-400 text-xs hover:bg-surface-700/80 transition-colors"
              >
                🔬 Open in Inspector
              </button>
            </div>
          ) : (
            <div className="text-surface-600 text-sm py-8 text-center">
              Click an event to inspect
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatEventSummary(evt: PlaybackEvent): string {
  const d = evt.data
  switch (evt.type) {
    case 'market_data':
      return `${d.symbol || evt.symbol} ${d.close || '—'} (vol: ${d.volume || '—'})`
    case 'signal':
      return `${d.strategy || ''} ${d.direction || ''} score:${d.score || '—'}`
    case 'decision':
      return `${d.result || ''} (${d.confidence ? Math.round(Number(d.confidence) * 100) + '%' : '—'})`
    case 'opportunity':
      return `${d.direction || ''} entry:${d.entry || '—'} RR:${d.risk_reward || '—'}`
    case 'trade_open':
      return `${d.direction || ''} entry:${d.entry || '—'} size:${d.size || '—'}`
    case 'trade_close':
      return `pnl:${d.pnl || '—'} ${d.reason || ''}`
    case 'trade_update':
      return `pnl:${d.pnl || '—'} price:${d.price || '—'}`
    case 'feature_update':
      return `${d.feature || ''} = ${d.value || ''}`
    case 'context_update':
      return `${d.regime || ''} · ${d.volatility || ''}`
    default:
      return Object.entries(d).slice(0, 2).map(([k, v]) => `${k}:${v}`).join(' ')
  }
}

function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
