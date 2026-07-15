const API_BASE = '/api/v1'

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ChartResponse {
  symbol: string
  interval: string
  candles: Candle[]
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`Chart API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export function fetchChart(symbol = 'BTCUSDT', interval = '1h', limit = 50): Promise<ChartResponse> {
  return fetchJson<ChartResponse>(`/chart?symbol=${symbol}&interval=${interval}&limit=${limit}`)
}
