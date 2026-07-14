import type { PluginSummary, PluginDetail, Category } from '../types'

const API_BASE = '/api/v1'

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  return res.json()
}

export function getPlugins(category?: string, search?: string, trust?: string): Promise<PluginSummary[]> {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (search) params.set('search', search)
  if (trust) params.set('trust', trust)
  const qs = params.toString()
  return fetchJson(`/plugins${qs ? `?${qs}` : ''}`)
}

export function getPluginDetail(id: string): Promise<PluginDetail> {
  return fetchJson(`/plugins/${id}`)
}

export function getCategories(): Promise<Category[]> {
  return fetchJson('/plugins/categories')
}

export function installPlugin(name: string, version?: string): Promise<{ status?: string; error?: string }> {
  return fetchJson('/plugins/install', {
    method: 'POST',
    body: JSON.stringify({ name, version }),
  })
}

export function removePlugin(name: string): Promise<{ status?: string; error?: string }> {
  return fetchJson('/plugins/remove', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updatePlugin(name: string): Promise<{ status?: string; error?: string }> {
  return fetchJson('/plugins/update', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function getUpdates(): Promise<{ name: string; display_name: string; installed_version: string; latest_version: string; icon: string; trust_level: string }[]> {
  return fetchJson('/plugins/updates')
}
