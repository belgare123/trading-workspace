import type { TraceGraph, FeatureInspect } from '../types'

const API_BASE = '/api/v1'

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export function getInspector(symbol: string): Promise<FeatureInspect> {
  return fetchJson(`/inspector/${encodeURIComponent(symbol)}`)
}

export function getTrace(symbol: string): Promise<TraceGraph> {
  return fetchJson(`/trace/${encodeURIComponent(symbol)}`)
}
