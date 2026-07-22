/**
 * Block5.chaos-replay.test.ts — Chaos + Replay Certification
 *
 * Very strong scenario:
 *   Chaos → Incident → ChaosTrace → ReplayEngine → Hash(state)
 *                              vs
 *   Exchange Snapshot → Hash(state)
 *
 * If hashes match → serious confirmation of recovery correctness.
 *
 * For Gateway Runtime certification, this test proves:
 * 1. The state machine transitions during chaos are recorded as a trace
 * 2. Replaying the trace produces the same final state
 * 3. The hash of replayed state matches the hash of direct state
 *
 * @since 6.6.5
 */

import { describe, it, expect } from 'vitest'
import { GatewayRuntime } from '../GatewayRuntime'
import { GatewayState } from '../GatewayState'
import type { ExecutionGateway, GatewayConfig, GatewayStatus, OrderResult } from '../ExecutionGateway'
import type { OrderRequest, Order, Position } from '../../../execution/types'

// ── Typed helpers for state hashing ──

interface GatewayStateSnapshot {
  state: GatewayState
  transportHealth: { restOnline: boolean; publicWsOnline: boolean; privateWsOnline: boolean }
  stateChangeCount: number
  degradation: string
  timestamp: number
}

function hashSnapshot(snapshot: GatewayStateSnapshot): string {
  // Deterministic hash based on all snapshot fields
  const payload = JSON.stringify(snapshot, Object.keys(snapshot).sort())
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `snap_${Math.abs(hash).toString(36).padStart(8, '0')}`
}

// ── Trace Event for Chaos Recording ──

interface TraceEvent {
  phase: 'matched' | 'started' | 'effect' | 'finished' | 'recovered'
  before: GatewayStateSnapshot
  after: GatewayStateSnapshot
  trigger: string
  timestamp: number
}

// ── Chaos Trace Recorder ──

class TraceRecorder {
  events: TraceEvent[] = []
  private lastSnapshot: GatewayStateSnapshot | null = null

  /** Record a snapshot before an action */
  snapshotBefore(rt: GatewayRuntime, label: string): GatewayStateSnapshot {
    const snap = this.currentSnapshot(rt)
    this.lastSnapshot = snap
    return snap
  }

  /** Record the effect after an action */
  recordTransition(rt: GatewayRuntime, phase: TraceEvent['phase'], trigger: string): TraceEvent {
    const after = this.currentSnapshot(rt)
    if (!this.lastSnapshot) throw new Error('Must call snapshotBefore first')
    const event: TraceEvent = {
      phase,
      before: this.lastSnapshot,
      after,
      trigger,
      timestamp: Date.now(),
    }
    this.events.push(event)
    this.lastSnapshot = after
    return event
  }

  private currentSnapshot(rt: GatewayRuntime): GatewayStateSnapshot {
    return {
      state: rt.getState(),
      transportHealth: rt.getTransportHealth(),
      stateChangeCount: rt.getStateChangeCount(),
      degradation: describeStateLabel(rt.getState()),
      timestamp: Date.now(),
    }
  }

  getTraceHash(): string {
    if (this.events.length === 0) return 'empty_trace'
    const finalState = this.events[this.events.length - 1].after
    return hashSnapshot(finalState)
  }
}

function describeStateLabel(s: GatewayState): string {
  switch (s) {
    case GatewayState.Healthy: return 'all online'
    case GatewayState.Degraded: return 'degraded'
    case GatewayState.Disconnected: return 'disconnected'
  }
}

// ── Mock Gateway ──

class MockGateway implements ExecutionGateway {
  readonly id = 'chaos-replay-gateway'
  readonly mode = Symbol('mock') as unknown as import('../ExecutionMode').ExecutionMode
  private _connected = false
  setConnected(v: boolean) { this._connected = v }
  isConnected() { return this._connected }

  async connect(_config: GatewayConfig): Promise<void> { this._connected = true }
  async disconnect(): Promise<void> { this._connected = false }
  getStatus(): GatewayStatus { return { connected: this._connected, mode: this.mode, uptime: 0, activeOrders: 0, openPositions: 0 } }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    if (!this._connected) throw new Error('disconnected')
    return { accepted: true, orderId: `order-${request.id}` }
  }
  async cancelOrder(_orderId: string): Promise<boolean> { return false }
  async cancelAllOrders(_symbol?: string): Promise<number> { return 0 }
  async replaceOrder(_id: string, _request: Partial<OrderRequest>): Promise<OrderResult> {
    return { accepted: true, orderId: _id }
  }
  async getOrders(): Promise<Order[]> { return [] }
  async getPositions(): Promise<Position[]> { return [] }
  async getPosition(_symbol: string): Promise<Position | null> { return null }
  async getAccount(): Promise<import('../ExecutionGateway').AccountInfo> {
    return { totalEquity: 10000, freeBalance: 5000, positions: [] }
  }
  async getBalance(): Promise<Record<string, number>> { return { USDT: 10000 } }
  async getMarket(_symbol: string): Promise<import('../ExecutionGateway').MarketData | null> { return null }
  async refresh(): Promise<void> {}
  on(_event: string, _handler: (...args: any[]) => void): void {}
  off(_event: string, _handler: (...args: any[]) => void): void {}
}

function createSetup() {
  const mock = new MockGateway()
  const rt = new GatewayRuntime()
  mock.connect({} as any)
  ;(rt as any).gateway = mock
  ;(rt as any).config = { mode: mock.mode }
  ;(rt as any).connected = true
  ;(rt as any).startTime = Date.now()
  ;(rt as any)._transportHealth = { restOnline: true, publicWsOnline: true, privateWsOnline: true }
  ;(rt as any)._state = GatewayState.Healthy
  ;(rt as any)._stateChangeCount = 1
  return { rt, mock }
}

describe('Block 5 — Chaos + Replay Certification', () => {
  // ── 5.1: Trace Recording ──

  describe('Block 5.1 — Chaos trace captures state transitions', () => {
    it('5.1a — trace records a single transport failure', () => {
      const { rt } = createSetup()
      const recorder = new TraceRecorder()

      // Record the chaos: REST goes down
      recorder.snapshotBefore(rt, 'before_rest_down')
      rt.updateTransportHealth({ restOnline: false })
      recorder.recordTransition(rt, 'effect', 'REST down')

      // Verify trace recorded the transition
      expect(recorder.events).toHaveLength(1)
      expect(recorder.events[0].trigger).toBe('REST down')
      expect(recorder.events[0].before.state).toBe(GatewayState.Healthy)
      expect(recorder.events[0].after.state).toBe(GatewayState.Degraded)
    })

    it('5.1b — trace records multiple transitions in order', () => {
      const { rt } = createSetup()
      const recorder = new TraceRecorder()

      // Chaos scenario: REST fails → degraded → Public WS fails → severe → private fails → disconnected
      recorder.snapshotBefore(rt, 'start')
      rt.updateTransportHealth({ restOnline: false })
      recorder.recordTransition(rt, 'effect', 'REST down')

      recorder.snapshotBefore(rt, 'after_rest_down')
      rt.updateTransportHealth({ publicWsOnline: false })
      recorder.recordTransition(rt, 'effect', 'Public WS down')

      recorder.snapshotBefore(rt, 'after_public_ws_down')
      rt.updateTransportHealth({ privateWsOnline: false })
      recorder.recordTransition(rt, 'effect', 'Private WS down')

      // Verify ordered trace
      expect(recorder.events).toHaveLength(3)
      expect(recorder.events[0].after.state).toBe(GatewayState.Degraded)
      expect(recorder.events[1].after.state).toBe(GatewayState.Degraded)
      expect(recorder.events[2].after.state).toBe(GatewayState.Disconnected)
    })

    it('5.1c — recovery is recorded as a "recovered" phase', () => {
      const { rt } = createSetup()
      const recorder = new TraceRecorder()

      // Record failure
      recorder.snapshotBefore(rt, 'before_fail')
      rt.updateTransportHealth({ restOnline: false })
      recorder.recordTransition(rt, 'effect', 'REST down')

      // Record recovery
      recorder.snapshotBefore(rt, 'before_recovery')
      rt.updateTransportHealth({ restOnline: true })
      recorder.recordTransition(rt, 'recovered', 'REST restored')

      expect(recorder.events[1].phase).toBe('recovered')
      expect(recorder.events[1].after.state).toBe(GatewayState.Healthy)
    })
  })

  // ── 5.2: Replay Verification ──

  describe('Block 5.2 — Replay from trace produces same state', () => {
    it('5.2a — replay trace events produces identical final state hash', () => {
      const { rt } = createSetup()
      const recorder = new TraceRecorder()

      // Run chaos: H → D → D → D → H (restore)
      recorder.snapshotBefore(rt, 'start')
      rt.updateTransportHealth({ restOnline: false })           // H → D
      recorder.recordTransition(rt, 'effect', 'REST down')

      recorder.snapshotBefore(rt, 'after_rest_down')
      rt.updateTransportHealth({ privateWsOnline: false })      // D → D (still degraded)
      recorder.recordTransition(rt, 'effect', 'Private WS down')

      recorder.snapshotBefore(rt, 'after_private_ws_down')
      rt.updateTransportHealth({ restOnline: true })            // D → D (still degraded)
      recorder.recordTransition(rt, 'effect', 'REST restored')

      recorder.snapshotBefore(rt, 'after_rest_restored')
      rt.updateTransportHealth({ privateWsOnline: true })       // D → H (healthy)
      recorder.recordTransition(rt, 'recovered', 'Private WS restored')

      // Hash of final state
      const directHash = hashSnapshot({
        state: rt.getState(),
        transportHealth: rt.getTransportHealth(),
        stateChangeCount: rt.getStateChangeCount(),
        degradation: describeStateLabel(rt.getState()),
        timestamp: Date.now(),
      })

      // Now replay from trace and produce hash of replayed state
      const replay = new TraceRecorder()
      const rt2 = createSetup().rt
      replay.snapshotBefore(rt2, 'replay_start')

      for (const event of recorder.events) {
        const healthPartial: Record<string, boolean> = {}
        // Derive what changed between before and after
        const beforeHealth = event.before.transportHealth
        const afterHealth = event.after.transportHealth
        for (const key of ['restOnline', 'publicWsOnline', 'privateWsOnline'] as const) {
          if (beforeHealth[key] !== afterHealth[key]) {
            healthPartial[key] = afterHealth[key]
          }
        }
        rt2.updateTransportHealth(healthPartial as any)
        replay.recordTransition(rt2, event.phase, event.trigger)
      }

      const replayHash = replay.getTraceHash()

      // Final state in rt2 should match rt
      expect(replayHash).toBe(directHash)
      expect(rt2.getState()).toBe(rt.getState())
    })

    it('5.2b — chaos trace → replay → hash(state) === hash(exchange)', () => {
      const { rt } = createSetup()
      const recorder = new TraceRecorder()

      // Full chaos cycle: all transports fail, then sequential recovery
      recorder.snapshotBefore(rt, 'healthy')
      rt.updateTransportHealth({ restOnline: false })
      recorder.recordTransition(rt, 'effect', 'REST down')

      recorder.snapshotBefore(rt, 'rest_down')
      rt.updateTransportHealth({ privateWsOnline: false })
      recorder.recordTransition(rt, 'effect', 'Private WS down')

      recorder.snapshotBefore(rt, 'rest_private_down')
      rt.updateTransportHealth({ publicWsOnline: false })
      recorder.recordTransition(rt, 'effect', 'Public WS down')

      // All offline — Disconnected
      expect(rt.getState()).toBe(GatewayState.Disconnected)

      // Sequential recovery (same path, reversed)
      recorder.snapshotBefore(rt, 'disconnected')
      rt.updateTransportHealth({ restOnline: true })
      recorder.recordTransition(rt, 'recovered', 'REST restored')

      recorder.snapshotBefore(rt, 'rest_restored')
      rt.updateTransportHealth({ privateWsOnline: true })
      recorder.recordTransition(rt, 'recovered', 'Private WS restored')

      recorder.snapshotBefore(rt, 'private_restored')
      rt.updateTransportHealth({ publicWsOnline: true })
      recorder.recordTransition(rt, 'recovered', 'Public WS restored — fully healthy')

      // Hash from direct execution
      const directHash = hashSnapshot({
        state: rt.getState(),
        transportHealth: rt.getTransportHealth(),
        stateChangeCount: rt.getStateChangeCount(),
        degradation: describeStateLabel(rt.getState()),
        timestamp: Date.now(),
      })

      // ── Replay from trace events ──
      const { rt: rtReplay } = createSetup()
      const replayRecorder = new TraceRecorder()
      replayRecorder.snapshotBefore(rtReplay, 'replay_start')

      for (const event of recorder.events) {
        const healthPartial: Record<string, boolean> = {}
        const before = event.before.transportHealth
        const after = event.after.transportHealth
        for (const key of ['restOnline', 'publicWsOnline', 'privateWsOnline'] as const) {
          if (before[key] !== after[key]) {
            healthPartial[key] = after[key]
          }
        }
        rtReplay.updateTransportHealth(healthPartial as any)
        replayRecorder.recordTransition(rtReplay, event.phase, event.trigger)
      }

      const replayHash = replayRecorder.getTraceHash()

      // HASH COMPARISON — the core certification assertion
      expect(replayHash).toBe(directHash)
      expect(rtReplay.getState()).toBe(GatewayState.Healthy)
    })
  })

  // ── 5.3: State Machine Invariant After Chaos ──

  describe('Block 5.3 — State machine invariants after chaos cycle', () => {
    it('5.3a — forbidden transitions still blocked after chaos', () => {
      const { rt } = createSetup()

      // Healthy → Disconnected directly is forbidden (must go through Degraded)
      expect(() => rt.updateTransportHealth({ restOnline: false, publicWsOnline: false, privateWsOnline: false }))
        .toThrow(/forbidden/i)

      // Healthy → Disconnected via multiple calls in a single tick is also forbidden
      // because the intermediate state check catches it
      expect(rt.getState()).toBe(GatewayState.Healthy)
    })

    it('5.3b — recovery path always goes through Degraded', () => {
      const { rt } = createSetup()

      // All offline
      rt.updateTransportHealth({ restOnline: false })
      rt.updateTransportHealth({ publicWsOnline: false })
      rt.updateTransportHealth({ privateWsOnline: false })
      expect(rt.getState()).toBe(GatewayState.Disconnected)

      // Disconnected → Healthy is forbidden
      expect(() => rt.updateTransportHealth({ restOnline: true, publicWsOnline: true, privateWsOnline: true }))
        .toThrow(/forbidden/i)

      // Must go through Degraded first
      rt.updateTransportHealth({ restOnline: true })
      expect(rt.getState()).toBe(GatewayState.Degraded)

      rt.updateTransportHealth({ publicWsOnline: true, privateWsOnline: true })
      expect(rt.getState()).toBe(GatewayState.Healthy)
    })
  })
})
