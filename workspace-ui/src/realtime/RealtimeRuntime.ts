/**
 * RealtimeRuntime — unified WebSocket manager.
 *
 * Manages one WebSocket connection per channel. Handles reconnection,
 * typed event dispatch, and connection-state tracking. Pages consume
 * data via React hooks (useScanner, useReplay, etc.) and never touch
 * WebSocket directly.
 */

// ── Channel configuration ──────────────────────────────────────────

export type StreamChannel =
  | 'scanner'
  | 'replay'
  | 'strategy'
  | 'events'
  | 'health'
  | 'plugins'

const CHANNEL_CONFIG: Record<StreamChannel, { path: string; reconnectMs: number }> = {
  scanner:  { path: '/ws/scanner',   reconnectMs: 3000 },
  replay:   { path: '/ws/replay',    reconnectMs: 5000 },
  strategy: { path: '/ws/strategies',reconnectMs: 5000 },
  events:   { path: '/ws/events',    reconnectMs: 5000 },
  health:   { path: '/ws/health',    reconnectMs: 5000 },
  plugins:  { path: '/ws/plugins',   reconnectMs: 5000 },
}

// ── Types ──────────────────────────────────────────────────────────

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface StreamMessage<T = unknown> {
  channel: StreamChannel
  type: string
  data: T
  timestamp: number
}

export type StreamHandler<T = unknown> = (msg: StreamMessage<T>) => void

export interface ChannelState {
  channel: StreamChannel
  connection: ConnectionState
  lastMessage: number | null
  messageCount: number
}

// ── Runtime ─────────────────────────────────────────────────────────

export class RealtimeRuntime {
  private wsMap = new Map<StreamChannel, WebSocket>()
  private handlers = new Map<StreamChannel, Set<StreamHandler>>()
  private reconnectTimers = new Map<StreamChannel, ReturnType<typeof setTimeout>>()
  private pingIntervals = new Map<StreamChannel, ReturnType<typeof setInterval>>()
  private stateMap = new Map<StreamChannel, ConnectionState>()
  private listenerCounters = new Map<StreamChannel, number>()
  private destroyed = false

  // ── Public API ───────────────────────────────────────────────────

  /** Subscribe to a stream channel. Returns unsubscribe function. */
  subscribe<T = unknown>(channel: StreamChannel, handler: StreamHandler<T>): () => void {
    if (this.destroyed) return () => {}

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set())
    }
    this.handlers.get(channel)!.add(handler as StreamHandler)

    // Track listener count for lazy connect
    const prev = this.listenerCounters.get(channel) || 0
    this.listenerCounters.set(channel, prev + 1)

    // Auto-connect on first subscriber
    if (prev === 0) {
      this.connect(channel)
    }

    return () => {
      const set = this.handlers.get(channel)
      if (set) {
        set.delete(handler as StreamHandler)
      }
      const cnt = (this.listenerCounters.get(channel) || 1) - 1
      if (cnt <= 0) {
        this.listenerCounters.delete(channel)
        this.disconnect(channel)
      } else {
        this.listenerCounters.set(channel, cnt)
      }
    }
  }

  /** Get current connection state for a channel. */
  getState(channel: StreamChannel): ConnectionState {
    return this.stateMap.get(channel) || 'disconnected'
  }

  /** Get a snapshot of all channel states. */
  getAllStates(): ChannelState[] {
    return (Object.keys(CHANNEL_CONFIG) as StreamChannel[]).map((ch) => ({
      channel: ch,
      connection: this.stateMap.get(ch) || 'disconnected',
      lastMessage: null,
      messageCount: 0,
    }))
  }

  /** Manually connect a channel (called automatically on first subscriber). */
  connect(channel: StreamChannel): void {
    if (this.destroyed) return
    if (this.wsMap.has(channel)) return

    const cfg = CHANNEL_CONFIG[channel]
    const wsUrl = `ws://${window.location.host}${cfg.path}`

    this.setState(channel, 'connecting')
    const ws = new WebSocket(wsUrl)
    this.wsMap.set(channel, ws)

    ws.onopen = () => {
      if (this.destroyed) { ws.close(); return }
      this.setState(channel, 'connected')

      // Ping every 25s
      const ping = setInterval(() => {
        const w = this.wsMap.get(channel)
        if (w && w.readyState === WebSocket.OPEN) {
          w.send('ping')
        } else {
          clearInterval(ping)
        }
      }, 25000)
      this.pingIntervals.set(channel, ping)
    }

    ws.onmessage = (event) => {
      if (this.destroyed) return
      try {
        const parsed = JSON.parse(event.data)
        const msg: StreamMessage = {
          channel,
          type: parsed.type || 'message',
          data: parsed.data ?? parsed,
          timestamp: Date.now(),
        }
        this.dispatch(channel, msg)
      } catch {
        // ignore malformed
      }
    }

    ws.onclose = () => {
      this.wsMap.delete(channel)
      this.clearPing(channel)
      this.setState(channel, 'disconnected')

      // Don't reconnect if no listeners remain
      if (this.destroyed) return
      if (!this.listenerCounters.has(channel)) return

      // Reconnect after delay
      const timer = setTimeout(() => {
        this.reconnectTimers.delete(channel)
        this.connect(channel)
      }, cfg.reconnectMs)
      this.reconnectTimers.set(channel, timer)
    }

    ws.onerror = () => {
      this.setState(channel, 'error')
      ws.close()
    }
  }

  /** Manually disconnect a channel. */
  disconnect(channel: StreamChannel): void {
    const ws = this.wsMap.get(channel)
    if (ws) {
      ws.close()
      this.wsMap.delete(channel)
    }
    this.clearPing(channel)
    const timer = this.reconnectTimers.get(channel)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(channel)
    }
    // Keep handlers registered so re-subscribe reconnects
  }

  /** Destroy the runtime — closes all connections. */
  destroy(): void {
    this.destroyed = true
    this.wsMap.forEach((ws) => ws.close())
    this.wsMap.clear()
    this.reconnectTimers.forEach((t) => clearTimeout(t))
    this.reconnectTimers.clear()
    this.pingIntervals.forEach((p) => clearInterval(p))
    this.pingIntervals.clear()
    this.handlers.clear()
    this.listenerCounters.clear()
    this.stateMap.clear()
  }

  // ── Internal ─────────────────────────────────────────────────────

  private setState(channel: StreamChannel, state: ConnectionState) {
    this.stateMap.set(channel, state)
    // Emit state change as a system event
    this.dispatch(channel, {
      channel,
      type: '__state_change',
      data: state,
      timestamp: Date.now(),
    })
  }

  private dispatch(channel: StreamChannel, msg: StreamMessage) {
    const handlers = this.handlers.get(channel)
    if (handlers) {
      handlers.forEach((fn) => fn(msg))
    }
    // Also dispatch to a wildcard handler (channel='*') if needed
  }

  private clearPing(channel: StreamChannel) {
    const p = this.pingIntervals.get(channel)
    if (p) {
      clearInterval(p)
      this.pingIntervals.delete(channel)
    }
  }

  /** True if any channel has at least one subscriber. */
  get hasActiveSubscriptions(): boolean {
    return this.listenerCounters.size > 0
  }
}

// ── Singleton ──────────────────────────────────────────────────────

/** Global singleton — instantiated once by RealtimeProvider. */
export const globalRuntime = new RealtimeRuntime()
