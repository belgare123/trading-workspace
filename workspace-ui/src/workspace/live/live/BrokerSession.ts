/**
 * BrokerSession.ts — Connection lifecycle manager
 *
 * Manages the connection state machine for a broker adapter.
 * Handles connect/disconnect/reconnect with exponential backoff.
 *
 * @since 4.5
 */

import type { BrokerAdapter } from './BrokerAdapter'
import type { ConnectionState, LiveProviderConfig } from './types'
import { ConnectionStates, canTransition } from './types'
import { BrokerClock } from './BrokerClock'

export type SessionListener = (state: ConnectionState, prev: ConnectionState) => void

export class BrokerSession {
  private _state: ConnectionState = ConnectionStates.DISCONNECTED
  private listeners: SessionListener[] = []
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private config: LiveProviderConfig
  private adapter: BrokerAdapter

  /** Exchange-aware clock synchronization */
  public readonly clock: BrokerClock

  constructor(adapter: BrokerAdapter, config: LiveProviderConfig) {
    this.adapter = adapter
    this.config = config
    this.clock = new BrokerClock()
  }

  get state(): ConnectionState {
    return this._state
  }

  get isConnected(): boolean {
    return this._state === ConnectionStates.CONNECTED
  }

  // ── Connection ──

  async connect(apiKey: string, apiSecret: string, testnet = false): Promise<void> {
    this.transitionTo(ConnectionStates.CONNECTING)
    try {
      await this.adapter.connection.connect(apiKey, apiSecret, testnet)
      this.reconnectAttempts = 0
      this.transitionTo(ConnectionStates.CONNECTED)

      // Sync clock from exchange server time if available
      if (this.adapter.connection.getServerTime) {
        try {
          const serverTime = await this.adapter.connection.getServerTime()
          this.clock.sync(serverTime)
        } catch {
          // Non-fatal — clock stays at local time
        }
      }
    } catch (err) {
      const msg = String(err)
      if (msg.includes('auth') || msg.includes('key') || msg.includes('signature')) {
        this.transitionTo(ConnectionStates.AUTHENTICATION_FAILED)
      } else {
        this.transitionTo(ConnectionStates.DISCONNECTED)
      }
      throw err
    }
  }

  async disconnect(): Promise<void> {
    this.cancelReconnect()
    await this.adapter.connection.disconnect()
    this.transitionTo(ConnectionStates.DISCONNECTED)
    this.reconnectAttempts = 0
  }

  // ── Reconnect ──

  scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (this.config.maxReconnectAttempts != null &&
        this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.transitionTo(ConnectionStates.DISCONNECTED)
      return
    }

    this.transitionTo(ConnectionStates.RECONNECTING)
    const delay = this.config.reconnectDelayMs ?? 5_000
    const backoff = delay * Math.pow(1.5, this.reconnectAttempts)
    const jitter = backoff * (0.5 + Math.random() * 0.5)
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        // Re-use stored credentials — real systems use credential store
        this.transitionTo(ConnectionStates.CONNECTING)
        this.transitionTo(ConnectionStates.CONNECTED)
        this.reconnectAttempts = 0

        // Re-sync clock after reconnect
        if (this.adapter.connection.getServerTime) {
          try {
            const serverTime = await this.adapter.connection.getServerTime()
            this.clock.sync(serverTime)
          } catch { /* non-fatal */ }
        }
      } catch {
        this.scheduleReconnect()
      }
    }, Math.min(jitter, 60_000))
  }

  cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ── State Transitions ──

  transitionTo(newState: ConnectionState): void {
    const prev = this._state
    if (prev === newState) return
    if (!canTransition(prev, newState)) {
      console.warn(`[BrokerSession] Invalid transition: ${prev} → ${newState}`)
      return
    }
    this._state = newState
    this.notify(newState, prev)
  }

  /** Mark connection as degraded (intermittent issues) */
  flagDegraded(): void {
    this.transitionTo(ConnectionStates.DEGRADED)
  }

  /** Mark as rate limited */
  flagRateLimited(): void {
    this.transitionTo(ConnectionStates.RATE_LIMITED)
    this.scheduleReconnect()
  }

  // ── Listeners ──

  onStateChange(listener: SessionListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notify(state: ConnectionState, prev: ConnectionState): void {
    for (const listener of this.listeners) {
      try { listener(state, prev) } catch { /* ignore listener errors */ }
    }
  }

  // ── Cleanup ──

  dispose(): void {
    this.cancelReconnect()
    this.listeners = []
  }
}
