/**
 * Types for the Global Event Timeline.
 */

import type { StreamChannel } from '../realtime'

/**
 * A single event in the timeline feed.
 */
export interface TimelineEvent {
  id: string
  channel: StreamChannel | 'system'
  type: string
  title: string
  description?: string
  data?: unknown
  timestamp: number
  severity: 'info' | 'success' | 'warning' | 'error'
  /** If set, clicking this event opens the Inspector for this inspection ID. */
  inspectId?: string
}

/**
 * Timeline store state.
 */
export interface TimelineState {
  /** Ring buffer of recent events (newest first). */
  events: TimelineEvent[]
  /** Currently selected event for the Inspector panel. */
  selectedEvent: TimelineEvent | null

  addEvent(event: TimelineEvent): void
  selectEvent(event: TimelineEvent | null): void
  clear(): void
}
