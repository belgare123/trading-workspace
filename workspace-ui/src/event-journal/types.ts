// src/event-journal/types.ts — Core types for Event Journal subsystem

export type RuntimeId =
  | 'gateway' | 'trade' | 'wallet' | 'risk' | 'strategy'
  | 'ordermanager' | 'exit' | 'feed' | 'telemetry' | 'system'

export interface JournalFilter {
  runtime?: RuntimeId
  type?: string | string[]
  traceId?: string
  tradeId?: string
  correlationId?: string
  afterSequence?: number
  beforeSequence?: number
  afterTimestamp?: number
  beforeTimestamp?: number
  limit?: number
}

export interface JournalFlushConfig {
  maxBufferedEvents: number
  maxFlushIntervalMs: number
  flushOnTradeClosed: boolean
  flushOnSnapshot: boolean
  flushOnShutdown: boolean
  flushOnEmergencyStop: boolean
  flushOnKillSwitch: boolean
  synchronousCriticalEvents: boolean
}

export interface RetentionPolicy {
  fullJournalDays: number
  keepSnapshots: number
  archiveMetadataForever: boolean
  compressArchivedJournal: boolean
  pruneOnStartup: boolean
  pruneDaily: boolean
}

export type CriticalEventType =
  | 'OrderSubmitted' | 'OrderAccepted' | 'OrderFilled' | 'OrderRejected'
  | 'PositionOpened' | 'PositionClosed'
  | 'WalletCommitted' | 'WalletWithdrawn'
  | 'RecoverySnapshot' | 'KillSwitchActivated'

export const CRITICAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'OrderSubmitted', 'OrderAccepted', 'OrderFilled', 'OrderRejected',
  'PositionOpened', 'PositionClosed',
  'WalletCommitted', 'WalletWithdrawn',
  'RecoverySnapshot', 'KillSwitchActivated',
])
