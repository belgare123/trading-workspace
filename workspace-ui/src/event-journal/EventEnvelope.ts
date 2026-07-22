// src/event-journal/EventEnvelope.ts — Core envelope for all events

import { randomUUID } from 'crypto'
import type { RuntimeId } from './types'

export interface EventEnvelopeMetadata {
  version: number
  schemaVersion: number
  source: string
}

export interface EventEnvelope<T = unknown> {
  id: string
  traceId: string
  causationId?: string
  correlationId?: string
  tradeId?: string
  runtime: RuntimeId
  type: string
  sequence: number
  timestamp: number
  payload: T
  metadata: EventEnvelopeMetadata
}

export interface CreateEventEnvelopeInput<T = unknown> {
  traceId: string
  causationId?: string
  correlationId?: string
  tradeId?: string
  runtime: RuntimeId
  type: string
  payload: T
  source?: string
  metadata?: Partial<EventEnvelopeMetadata>
}

/** Build a new EventEnvelope. Sequence is set by the Journal on append. */
export function createEventEnvelope<T>(input: CreateEventEnvelopeInput<T>): Omit<EventEnvelope<T>, 'sequence'> {
  return {
    id: randomUUID(),
    traceId: input.traceId,
    causationId: input.causationId,
    correlationId: input.correlationId,
    tradeId: input.tradeId,
    runtime: input.runtime,
    type: input.type,
    sequence: 0,
    timestamp: Date.now(),
    payload: input.payload,
    metadata: {
      version: input.metadata?.version ?? 1,
      schemaVersion: input.metadata?.schemaVersion ?? 1,
      source: input.source ?? 'workspace-ui:2.0.0',
    },
  }
}
