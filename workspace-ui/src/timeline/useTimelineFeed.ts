import { useEffect, useRef } from 'react'
import { useTimelineStore } from './TimelineStore'
import { globalRuntime, type StreamChannel, type StreamMessage } from '../realtime'
import type { TimelineEvent } from './types'

// ── Channel-to-event mapping ──────────────────────────────────────

const TIMELINE_CHANNELS: StreamChannel[] = [
  'scanner',
  'replay',
  'strategy',
  'events',
  'health',
  'plugins',
]

function inferSeverity(msg: StreamMessage): 'info' | 'success' | 'warning' | 'error' {
  const t = msg.type.toLowerCase()
  if (t.includes('error') || t.includes('fail')) return 'error'
  if (t.includes('warn') || t.includes('alert')) return 'warning'
  if (t.includes('trade') || t.includes('open') || t.includes('close') || t.includes('profit'))
    return 'success'
  return 'info'
}

function inferTitle(msg: StreamMessage): string {
  const t = msg.type.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function makeEventId(msg: StreamMessage): string {
  return `${msg.channel}:${msg.type}:${msg.timestamp}`
}

// ── Hook ──────────────────────────────────────────────────────────

/**
 * Feeds all RealtimeRuntime streams into the EventTimelineStore.
 * Mount once at the app root (inside TimelineDock).
 */
export function useTimelineFeed() {
  const addEvent = useTimelineStore((s) => s.addEvent)
  const unsubsRef = useRef<(() => void)[]>([])

  useEffect(() => {
    const handler = (msg: StreamMessage) => {
      // Skip state-change system messages
      if (msg.type === '__state_change') return

      const event: TimelineEvent = {
        id: makeEventId(msg),
        channel: msg.channel,
        type: msg.type,
        title: inferTitle(msg),
        description:
          typeof msg.data === 'object' && msg.data !== null
            ? JSON.stringify(msg.data).slice(0, 200)
            : String(msg.data ?? '').slice(0, 200),
        data: msg.data,
        timestamp: msg.timestamp,
        severity: inferSeverity(msg),
      }
      addEvent(event)
    }

    const unsubs = TIMELINE_CHANNELS.map((ch) => globalRuntime.subscribe(ch, handler))
    unsubsRef.current = unsubs

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [addEvent])
}
