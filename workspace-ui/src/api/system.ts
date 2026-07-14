import type { SystemOverview } from '../types'

const BASE = '/api/v1/system'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`System API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export function fetchSystemOverview(): Promise<SystemOverview> {
  return fetchJson<SystemOverview>(`${BASE}/overview`)
}

export function fetchSystemServices(): Promise<SystemOverview['services']> {
  return fetchJson(`${BASE}/services`)
}

export function fetchSystemResources(): Promise<SystemOverview['resources']> {
  return fetchJson(`${BASE}/resources`)
}

export function fetchSystemEvents(): Promise<SystemOverview['event_store']> {
  return fetchJson(`${BASE}/events`)
}

export function fetchSystemWebSockets(): Promise<SystemOverview['websockets']> {
  return fetchJson(`${BASE}/websockets`)
}

export function fetchSystemPlugins(): Promise<SystemOverview['plugins']> {
  return fetchJson(`${BASE}/plugins`)
}

export function fetchSystemTimeline(): Promise<SystemOverview['timeline']> {
  return fetchJson(`${BASE}/timeline`)
}

export function fetchSystemAlerts(): Promise<SystemOverview['alerts']> {
  return fetchJson(`${BASE}/alerts`)
}

export function fetchSystemHealth(): Promise<SystemOverview['health']> {
  return fetchJson(`${BASE}/health`)
}
