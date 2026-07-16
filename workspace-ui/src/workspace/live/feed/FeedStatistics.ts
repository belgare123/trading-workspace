/**
 * FeedStatistics.ts — Tracks feed health metrics
 *
 * Monitors latency, reconnection attempts, disconnections,
 * and message throughput for each feed adapter.
 *
 * @since 4.2
 */

export interface AdapterStats {
  adapterId: string
  connected: boolean
  uptime: number
  messagesReceived: number
  disconnections: number
  reconnections: number
  lastLatencyMs: number
  avgLatencyMs: number
  lastConnectedAt: number | null
  lastDisconnectedAt: number | null
}

export class FeedStatistics {
  private stats = new Map<string, AdapterStats>()
  private latencySamples = new Map<string, number[]>()
  private readonly MAX_LATENCY_SAMPLES = 100

  /** Register a new adapter for tracking */
  registerAdapter(adapterId: string): void {
    if (this.stats.has(adapterId)) return
    this.stats.set(adapterId, {
      adapterId,
      connected: false,
      uptime: 0,
      messagesReceived: 0,
      disconnections: 0,
      reconnections: 0,
      lastLatencyMs: 0,
      avgLatencyMs: 0,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
    })
    this.latencySamples.set(adapterId, [])
  }

  /** Record a connection event */
  recordConnected(adapterId: string): void {
    const s = this.stats.get(adapterId)
    if (!s) return
    s.connected = true
    s.lastConnectedAt = Date.now()
  }

  /** Record a disconnection event */
  recordDisconnected(adapterId: string): void {
    const s = this.stats.get(adapterId)
    if (!s) return
    s.connected = false
    s.disconnections++
    s.lastDisconnectedAt = Date.now()
  }

  /** Record a reconnection event */
  recordReconnected(adapterId: string): void {
    const s = this.stats.get(adapterId)
    if (!s) return
    s.connected = true
    s.reconnections++
    s.lastConnectedAt = Date.now()
  }

  /** Record a received message */
  recordMessage(adapterId: string): void {
    const s = this.stats.get(adapterId)
    if (!s) return
    s.messagesReceived++
  }

  /** Record a latency sample */
  recordLatency(adapterId: string, latencyMs: number): void {
    const s = this.stats.get(adapterId)
    if (!s) return
    s.lastLatencyMs = latencyMs

    const samples = this.latencySamples.get(adapterId)!
    samples.push(latencyMs)
    if (samples.length > this.MAX_LATENCY_SAMPLES) {
      samples.shift()
    }
    s.avgLatencyMs = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
  }

  /** Update uptime for all connected adapters */
  tick(): void {
    const now = Date.now()
    for (const s of this.stats.values()) {
      if (s.connected && s.lastConnectedAt) {
        s.uptime = Math.floor((now - s.lastConnectedAt) / 1000)
      }
    }
  }

  /** Get stats for a specific adapter */
  get(adapterId: string): AdapterStats | undefined {
    return this.stats.get(adapterId)
  }

  /** Get all adapter stats */
  getAll(): AdapterStats[] {
    return Array.from(this.stats.values())
  }

  /** Remove adapter tracking */
  unregister(adapterId: string): void {
    this.stats.delete(adapterId)
    this.latencySamples.delete(adapterId)
  }

  /** Reset all stats */
  reset(): void {
    this.stats.clear()
    this.latencySamples.clear()
  }
}
