// ── Trading Workspace: Shared Types ──
// Sprint 5.4 — Workspace Composition & Lifecycle

import type { ExecutionMode } from '../live/gateway/ExecutionMode'

// ════════════════════════════════════════
// TradingConfig
// ════════════════════════════════════════

export interface TradingConfig {
  /** Workspace name (for logging, lockfiles) */
  name: string

  /** Execution mode: 'live' | 'paper' | 'simulation' */
  mode: ExecutionMode

  /** Broker identifier: 'bybit' | 'binance' | 'mock' | 'paper' */
  broker: string

  /** Trading symbols */
  symbols: string[]

  /** Strategy identifier (from StrategyRegistry) */
  strategyId?: string

  /** Optional mode-specific config */
  testnet?: boolean

  /** Initial paper balance (paper mode only) */
  paperBalance?: number

  /** State directory for persistence */
  stateDir?: string
}

// ════════════════════════════════════════
// DependencyGraph — runtime ordering
// ════════════════════════════════════════

export type RuntimeId =
  | 'feed'
  | 'gateway'
  | 'risk'
  | 'recovery'
  | 'strategy'
  | 'trade'
  | 'history'
  | 'killswitch'

export interface RuntimeDependency {
  runtime: RuntimeId
  dependsOn: RuntimeId[]
}

export const DEFAULT_RUNTIME_ORDER: RuntimeDependency[] = [
  { runtime: 'feed',       dependsOn: [] },
  { runtime: 'gateway',    dependsOn: ['feed'] },
  { runtime: 'risk',       dependsOn: ['gateway'] },
  { runtime: 'history',    dependsOn: ['gateway'] },
  { runtime: 'recovery',   dependsOn: ['gateway', 'risk', 'history'] },
  { runtime: 'strategy',   dependsOn: ['feed', 'recovery'] },
  { runtime: 'trade',      dependsOn: ['gateway', 'risk', 'strategy'] },
  { runtime: 'killswitch', dependsOn: ['gateway', 'risk'] },
]

// ════════════════════════════════════════
// RecoveryReport
// ════════════════════════════════════════

export interface RecoveryReport {
  recoveredTrades: number
  recoveredOrders: number
  recoveredPositions: number
  warnings: string[]
  errors: string[]
  durationMs: number
  healthy: boolean
}

// ════════════════════════════════════════
// WorkspaceHealth
// ════════════════════════════════════════

export interface WorkspaceHealth {
  status: LifecycleState
  uptimeMs: number
  gatewayConnected: boolean
  safeMode: boolean
  runtimes: Record<RuntimeId, 'running' | 'stopped' | 'error'>
  recoveryReport?: RecoveryReport
}

// ════════════════════════════════════════
// Lifecycle FSM
// ════════════════════════════════════════

export const LIFECYCLE_STATES = {
  CREATED:      'CREATED',
  INITIALIZING: 'INITIALIZING',
  RECOVERING:   'RECOVERING',
  RUNNING:      'RUNNING',
  SAFE_MODE:    'SAFE_MODE',
  DEGRADED:     'DEGRADED',
  STOPPING:     'STOPPING',
  STOPPED:      'STOPPED',
} as const

export type LifecycleState = (typeof LIFECYCLE_STATES)[keyof typeof LIFECYCLE_STATES]

export const LIFECYCLE_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  CREATED:      ['INITIALIZING'],
  INITIALIZING: ['RECOVERING', 'STOPPING'],
  RECOVERING:   ['RUNNING', 'DEGRADED', 'STOPPING'],
  RUNNING:      ['DEGRADED', 'SAFE_MODE', 'STOPPING'],
  SAFE_MODE:    ['RUNNING', 'STOPPING'],
  DEGRADED:     ['RUNNING', 'SAFE_MODE', 'STOPPING'],
  STOPPING:     ['STOPPED'],
  STOPPED:      [],
}

export type LifecycleEventType =
  | 'state:entered'
  | 'state:exited'
  | 'error'
  | 'recovery:complete'
  | 'killswitch:triggered'

export type LifecycleEventHandler = (
  event: LifecycleEventType,
  state: LifecycleState,
  detail?: unknown
) => void
