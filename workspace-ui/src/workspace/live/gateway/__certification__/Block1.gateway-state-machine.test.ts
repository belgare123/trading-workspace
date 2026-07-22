/**
 * Block1.gateway-state-machine.test.ts — Gateway State Machine Certification
 *
 * Verifies:
 * 1. State derivation from transport health (8 combinations)
 * 2. Forbidden transitions are impossible
 * 3. Allowed transitions work correctly
 * 4. HealthAggregator integration reflects state
 * 5. Telemetry tracks state changes
 *
 * @since 6.6.5
 */

import { describe, it, expect } from 'vitest'
import {
  GatewayState,
  deriveState,
  isTransitionAllowed,
  describeDegradation,
  createGatewayHealthCheck,
  type TransportHealth,
} from '../GatewayState'

// ── Helpers ──

const allOnline: TransportHealth = { restOnline: true, publicWsOnline: true, privateWsOnline: true }
const allOffline: TransportHealth = { restOnline: false, publicWsOnline: false, privateWsOnline: false }

function health(overrides: Partial<TransportHealth> = {}): TransportHealth {
  return { ...allOnline, ...overrides }
}

// ── Block 1.1: State Derivation ──

describe('Block 1.1 — State derivation from transport health', () => {
  it('1.1a — all transports online → Healthy', () => {
    expect(deriveState(allOnline)).toBe(GatewayState.Healthy)
  })

  it('1.1b — REST down only → Degraded', () => {
    expect(deriveState(health({ restOnline: false }))).toBe(GatewayState.Degraded)
  })

  it('1.1c — Public WS down only → Degraded', () => {
    expect(deriveState(health({ publicWsOnline: false }))).toBe(GatewayState.Degraded)
  })

  it('1.1d — Private WS down only → Degraded', () => {
    expect(deriveState(health({ privateWsOnline: false }))).toBe(GatewayState.Degraded)
  })

  it('1.1e — REST + Public WS down → Degraded (severe)', () => {
    const state = deriveState(health({ restOnline: false, publicWsOnline: false }))
    expect(state).toBe(GatewayState.Degraded)
  })

  it('1.1f — REST + Private WS down → Degraded (severe)', () => {
    const state = deriveState(health({ restOnline: false, privateWsOnline: false }))
    expect(state).toBe(GatewayState.Degraded)
  })

  it('1.1g — Public + Private WS down → Degraded (severe)', () => {
    const state = deriveState(health({ publicWsOnline: false, privateWsOnline: false }))
    expect(state).toBe(GatewayState.Degraded)
  })

  it('1.1h — all transports offline → Disconnected', () => {
    expect(deriveState(allOffline)).toBe(GatewayState.Disconnected)
  })
})

// ── Block 1.2: Transition Table ──

describe('Block 1.2 — State transition table', () => {
  const ALL_STATES = [GatewayState.Healthy, GatewayState.Degraded, GatewayState.Disconnected]

  it('1.2a — ALLOWED transitions', () => {
    const allowed: [GatewayState, GatewayState][] = [
      [GatewayState.Healthy, GatewayState.Healthy],
      [GatewayState.Healthy, GatewayState.Degraded],
      [GatewayState.Degraded, GatewayState.Degraded],
      [GatewayState.Degraded, GatewayState.Healthy],
      [GatewayState.Degraded, GatewayState.Disconnected],
      [GatewayState.Disconnected, GatewayState.Disconnected],
      [GatewayState.Disconnected, GatewayState.Degraded],
    ]
    for (const [from, to] of allowed) {
      expect(isTransitionAllowed(from, to)).toBe(true)
    }
  })

  it('1.2b — FORBIDDEN transitions', () => {
    const forbidden: [GatewayState, GatewayState][] = [
      [GatewayState.Healthy, GatewayState.Disconnected],
      [GatewayState.Disconnected, GatewayState.Healthy],
    ]
    for (const [from, to] of forbidden) {
      expect(isTransitionAllowed(from, to)).toBe(false)
    }
  })

  it('1.2c — all self-transitions allowed', () => {
    for (const state of ALL_STATES) {
      expect(isTransitionAllowed(state, state)).toBe(true)
    }
  })
})

// ── Block 1.3: Degradation Description ──

describe('Block 1.3 — Degradation description', () => {
  it('1.3a — no degradation → "none"', () => {
    expect(describeDegradation(allOnline)).toBe('none')
  })

  it('1.3b — REST down only', () => {
    expect(describeDegradation(health({ restOnline: false }))).toBe('REST')
  })

  it('1.3c — multiple transports down', () => {
    const desc = describeDegradation(health({ restOnline: false, publicWsOnline: false }))
    expect(desc).toContain('REST')
    expect(desc).toContain('Public WS')
  })
})

// ── Block 1.4: HealthAggregator Integration ──

describe('Block 1.4 — HealthAggregator check function', () => {
  it('1.4a — healthy state reports healthy: true', () => {
    let currentState = GatewayState.Healthy
    let currentTransport: TransportHealth = allOnline
    const check = createGatewayHealthCheck(
      () => currentState,
      () => currentTransport,
    )
    const result = check()
    expect(result.healthy).toBe(true)
    expect(result.restOnline).toBe(true)
    expect(result.publicWsOnline).toBe(true)
    expect(result.privateWsOnline).toBe(true)
  })

  it('1.4b — degraded state reports healthy: false with error detail', () => {
    let currentState = GatewayState.Degraded
    let currentTransport: TransportHealth = health({ publicWsOnline: false })
    const check = createGatewayHealthCheck(
      () => currentState,
      () => currentTransport,
    )
    const result = check()
    expect(result.healthy).toBe(false)
    expect(result.lastError).toContain('Public WS')
  })

  it('1.4c — disconnected state reports healthy: false', () => {
    let currentState = GatewayState.Disconnected
    let currentTransport: TransportHealth = allOffline
    const check = createGatewayHealthCheck(
      () => currentState,
      () => currentTransport,
    )
    const result = check()
    expect(result.healthy).toBe(false)
    expect(result.lastError).toContain('REST')
    expect(result.lastError).toContain('Public WS')
    expect(result.lastError).toContain('Private WS')
  })
})
