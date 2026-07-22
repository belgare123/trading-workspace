/**
 * telemetry.ts — Client-side SLI telemetry API
 *
 * Client-side stubs for fetching telemetry/SLI data.
 * Backend serves from RuntimeTelemetry.instance.snapshot().
 * Falls back to optimistic empty data when backend is unavailable.
 *
 * @since 6.3.0
 */

import type { SliRuntimeSnapshot } from '../workspace/live/sli/SliTypes'

const BASE = '/api/v1/telemetry'

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url)
    if (!res.ok) return fallback
    return res.json() as Promise<T>
  } catch {
    return fallback
  }
}

/**
 * Fetch full SLI snapshot from all Runtimes.
 * Returns null if backend is unavailable.
 */
export function fetchSliSnapshot(): Promise<SliRuntimeSnapshot[]> {
  return fetchJson<SliRuntimeSnapshot[]>(`${BASE}/sli`, [])
}

/**
 * Fetch SLI snapshot for a specific domain.
 * Returns null if domain not found or backend unavailable.
 */
export async function fetchDomainSli(domain: string): Promise<SliRuntimeSnapshot | null> {
  const snapshots = await fetchSliSnapshot()
  return snapshots.find(s => s.domain === domain) ?? null
}

/**
 * Fetch SLI snapshot for gateway domain.
 */
export function fetchGatewaySli(): Promise<SliRuntimeSnapshot | null> {
  return fetchDomainSli('gateway')
}

/**
 * Fetch SLI snapshot for trade domain.
 */
export function fetchTradeSli(): Promise<SliRuntimeSnapshot | null> {
  return fetchDomainSli('trade')
}

/**
 * Fetch SLI snapshot for risk domain.
 */
export function fetchRiskSli(): Promise<SliRuntimeSnapshot | null> {
  return fetchDomainSli('risk')
}

/**
 * Fetch SLI snapshot for strategy domain.
 */
export function fetchStrategySli(): Promise<SliRuntimeSnapshot | null> {
  return fetchDomainSli('strategy')
}

/**
 * Fetch SLI snapshot for wallet domain.
 */
export function fetchWalletSli(): Promise<SliRuntimeSnapshot | null> {
  return fetchDomainSli('wallet')
}
