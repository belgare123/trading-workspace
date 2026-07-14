import { useState, useEffect, useRef } from 'react'
import { useRealtimeRuntime } from './RealtimeContext'
import type { StreamChannel, StreamMessage, ConnectionState } from './RealtimeRuntime'
import type { ScannerItem } from '../types'

// ── Generic hook factory ───────────────────────────────────────────

/**
 * Generic hook to subscribe to any stream channel.
 * Returns the last message data and connection state.
 */
export function useStream<T = unknown>(channel: StreamChannel, initialState: T): {
  data: T
  connectionState: ConnectionState
  lastMessage: StreamMessage<T> | null
} {
  const runtime = useRealtimeRuntime()
  const [state, setState] = useState<{
    data: T
    connectionState: ConnectionState
    lastMessage: StreamMessage<T> | null
  }>({
    data: initialState,
    connectionState: 'disconnected',
    lastMessage: null,
  })

  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const handler = (msg: StreamMessage<T>) => {
      if (msg.type === '__state_change') {
        setState((prev) => ({ ...prev, connectionState: msg.data as ConnectionState }))
        return
      }
      setState({
        data: msg.data,
        connectionState: stateRef.current.connectionState,
        lastMessage: msg,
      })
    }

    const unsubscribe = runtime.subscribe(channel, handler)
    return unsubscribe
  }, [channel, runtime])

  return state
}

// ── Typed stream hooks ─────────────────────────────────────────────

/**
 * Scanner live stream — array of scanner items.
 * Pages use this instead of useScannerWs.
 */
export function useScanner(initialItems: ScannerItem[] = []): {
  items: ScannerItem[]
  connectionState: ConnectionState
} {
  const { data, connectionState } = useStream<ScannerItem[]>('scanner', initialItems)
  return { items: data, connectionState }
}

/**
 * Replay event stream.
 */
export function useReplay() {
  return useStream<Record<string, unknown>[]>('replay', [])
}

/**
 * Strategy event stream.
 */
export function useStrategies() {
  return useStream<Record<string, unknown>>('strategy', {})
}

/**
 * Event store stream — latest platform events.
 */
export function useEvents() {
  return useStream<Record<string, unknown>[]>('events', [])
}

/**
 * Health stream — live system health updates.
 */
export function useHealth() {
  return useStream<Record<string, unknown>>('health', {})
}

/**
 * Plugin event stream — install/uninstall/error events.
 */
export function usePluginEvents() {
  return useStream<Record<string, unknown>>('plugins', {})
}
