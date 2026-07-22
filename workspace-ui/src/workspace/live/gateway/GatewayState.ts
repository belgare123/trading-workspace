/**
 * GatewayState.ts — Gateway Runtime State Machine
 *
 * Tracks the health of each transport channel (REST, Public WS, Private WS)
 * and derives the overall GatewayState using a deterministic transition table.
 *
 * States:
 *   Healthy      — all 3 transports online
 *   Degraded     — at least 1 transport down (>1 = "severe degraded")
 *   Disconnected — all 3 transports down
 *
 * Forbidden transitions:
 *   Healthy ↔ Disconnected (must pass through Degraded)
 *   Degraded → Healthy (requires explicit recovery/reconnect, not spontaneous)
 *
 * @since 6.6.5
 */

import type { HealthCheckFn } from '../../../runtime/observability/HealthAggregator'

// ── Transport Health ──

export interface TransportHealth {
  restOnline: boolean
  publicWsOnline: boolean
  privateWsOnline: boolean
}

// ── Gateway State ──

export enum GatewayState {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Disconnected = 'disconnected',
}

/** Human-readable severity label for the state */
export function describeState(state: GatewayState): string {
  switch (state) {
    case GatewayState.Healthy: return 'all transports online'
    case GatewayState.Degraded: return 'one or more transports offline'
    case GatewayState.Disconnected: return 'all transports offline'
  }
}

// ── Transition Table ──

export interface GatewayStateTransition {
  from: GatewayState
  to: GatewayState
  trigger: string
  allowed: boolean
}

/**
 * Deterministic transition rules.
 * Returns false for forbidden transitions.
 */
export function isTransitionAllowed(from: GatewayState, to: GatewayState): boolean {
  // Healthy ←→ Disconnected is NEVER allowed directly
  if (from === GatewayState.Healthy && to === GatewayState.Disconnected) return false
  if (from === GatewayState.Disconnected && to === GatewayState.Healthy) return false

  // Healthy → Degraded (allowed — transport loss)
  if (from === GatewayState.Healthy && to === GatewayState.Degraded) return true

  // Degraded → Healthy (allowed only via explicit recovery/reconnect)
  if (from === GatewayState.Degraded && to === GatewayState.Healthy) return true

  // Degraded → Disconnected (allowed — last transport lost)
  if (from === GatewayState.Degraded && to === GatewayState.Disconnected) return true

  // Disconnected → Degraded (allowed — first transport restored)
  if (from === GatewayState.Disconnected && to === GatewayState.Degraded) return true

  // Same state is always allowed (no-op)
  if (from === to) return true

  return false
}

/**
 * Derive GatewayState from transport health.
 */
export function deriveState(health: TransportHealth): GatewayState {
  const online = [health.restOnline, health.publicWsOnline, health.privateWsOnline]
  const countOnline = online.filter(Boolean).length

  if (countOnline === 3) return GatewayState.Healthy
  if (countOnline === 0) return GatewayState.Disconnected
  return GatewayState.Degraded
}

/**
 * Describe degradation level.
 */
export function describeDegradation(health: TransportHealth): string {
  const parts: string[] = []
  if (!health.restOnline) parts.push('REST')
  if (!health.publicWsOnline) parts.push('Public WS')
  if (!health.privateWsOnline) parts.push('Private WS')
  if (parts.length === 0) return 'none'
  return parts.join(', ')
}

// ── HealthAggregator Integration ──

export function createGatewayHealthCheck(
  getState: () => GatewayState,
  getTransportHealth: () => TransportHealth,
): HealthCheckFn {
  return () => {
    const state = getState()
    const transport = getTransportHealth()
    return {
      healthy: state === GatewayState.Healthy,
      state,
      restOnline: transport.restOnline,
      publicWsOnline: transport.publicWsOnline,
      privateWsOnline: transport.privateWsOnline,
      lastError: state !== GatewayState.Healthy
        ? `Gateway ${state}: ${describeDegradation(transport)} offline`
        : undefined,
    }
  }
}
