const API_BASE = '/api/v1'

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export interface ScannerItemDTO {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  score: number
  signals: string[]
  direction: string
  timestamp: number
}

export const api = {
  scanner: {
    list: () => fetchJson<ScannerItemDTO[]>('/scanner'),
  },
  system: {
    status: () => fetchJson<Record<string, unknown>>('/system/status'),
  },
}
