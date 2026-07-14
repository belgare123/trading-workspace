import type { PlaybackSession, PlaybackState, PlaybackEvent } from '../types'

const API_BASE = '/api/v1'

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export function getSessions(): Promise<PlaybackSession[]> {
  return fetchJson('/replay/sessions')
}

export function loadSession(sessionId: string): Promise<{ session_id: string; status: string; total_events: number }> {
  return fetchJson('/replay/load', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  })
}

export function getReplayState(): Promise<PlaybackState> {
  return fetchJson('/replay/state')
}

export function controlReplay(action: string, payload?: Record<string, unknown>): Promise<PlaybackState> {
  return fetchJson('/replay/control', {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  })
}

export function getReplayEvent(step: number, session?: string): Promise<PlaybackEvent> {
  return fetchJson(`/replay/event/${step}${session ? `?session=${session}` : ''}`)
}
