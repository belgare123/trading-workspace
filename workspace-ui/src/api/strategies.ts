import type { StrategySummary, StrategyDetail, StrategyMetricsData } from '../types'

const API_BASE = '/api/v1'

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  return res.json()
}

export function getStrategies(): Promise<StrategySummary[]> {
  return fetchJson('/strategies')
}

export function getStrategy(id: string): Promise<StrategyDetail> {
  return fetchJson(`/strategies/${id}`)
}

export function getStrategyMetrics(id: string): Promise<StrategyMetricsData> {
  return fetchJson(`/strategies/${id}/metrics`)
}

export function controlStrategy(id: string, action: string): Promise<{ id: string; status: string }> {
  return fetchJson(`/strategies/${id}/control`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}
