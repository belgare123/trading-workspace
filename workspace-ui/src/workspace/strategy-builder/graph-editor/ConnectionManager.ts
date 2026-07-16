// ── ConnectionManager — Port-drag to edge creation ──
//
// Handles the "rubber band" connection workflow:
//   pointer down on port → drag → pointer up on target port → edge created
//
// Pure UI state machine — emits ConnectionState changes.
// Does NOT modify StrategyGraph directly — delegates to GraphEditorRuntime.
//
// @since 3.6.3

import type { BuilderEventBus } from '../runtime/BuilderEventBus'
import type { NodeRuntime } from '../nodes/NodeRuntime'
import type { PortDefinition } from '../nodes/types'
import type { ConnectionState, ConnectionCandidate } from './types'

export type ConnectionHandler = (candidate: ConnectionCandidate) => void

export class ConnectionManager {
  private _state: ConnectionState = {
    phase: 'idle',
    sourceId: null,
    sourcePortId: null,
    cursorPosition: { x: 0, y: 0 },
    validTargetId: null,
    validTargetPortId: null,
  }

  private _onConnect: ConnectionHandler | null = null
  private _eventBus: BuilderEventBus | null = null
  private _nodeRuntime: NodeRuntime | null = null
  constructor() {
  }

  connect(
    eventBus: BuilderEventBus,
    nodeRuntime: NodeRuntime,
    onConnect: ConnectionHandler,
  ): void {
    this._eventBus = eventBus
    this._nodeRuntime = nodeRuntime
    this._onConnect = onConnect
  }

  /** Start dragging from a port */
  startConnection(sourceNodeId: string, sourcePortId: string): void {
    this._state = {
      phase: 'dragging-from-port',
      sourceId: sourceNodeId,
      sourcePortId,
      cursorPosition: { x: 0, y: 0 },
      validTargetId: null,
      validTargetPortId: null,
    }
    this._emitState()
  }

  /** Update cursor position during drag */
  updatePosition(pos: { x: number; y: number }): void {
    if (this._state.phase === 'idle') return

    this._state.cursorPosition = pos

    // Hit-test against compatible ports
    const hit = this._findCompatiblePort(pos)
    if (hit) {
      this._state.validTargetId = hit.nodeId
      this._state.validTargetPortId = hit.portId
      this._state.phase = 'valid-target'
    } else {
      this._state.validTargetId = null
      this._state.validTargetPortId = null
      this._state.phase = 'dragging-from-port'
    }

    this._emitState()
  }

  /** Complete the connection — drop on target or cancel */
  endConnection(pos?: { x: number; y: number }): void {
    if (this._state.phase === 'idle') return

    // If we have a valid target at the drop position
    if (pos && this._state.validTargetId && this._state.validTargetPortId) {
      this._onConnect?.({
        sourceNodeId: this._state.sourceId!,
        sourcePortId: this._state.sourcePortId!,
        targetNodeId: this._state.validTargetId,
        targetPortId: this._state.validTargetPortId,
      })
    }

    this._reset()
  }

  /** Cancel connection drag */
  cancelConnection(): void {
    this._reset()
  }

  /** Get current connection state */
  get state(): Readonly<ConnectionState> {
    return this._state
  }

  /** Whether a connection drag is in progress */
  get isActive(): boolean {
    return this._state.phase !== 'idle'
  }

  // ── Private ──

  private _findCompatiblePort(pos: { x: number; y: number }): { nodeId: string; portId: string } | null {
    if (!this._nodeRuntime) return null

    // Find node at position
    const hit = this._nodeRuntime.hitTest(pos)
    if (!hit || !hit.instance) return null
    if (hit.instance.id === this._state.sourceId) return null // can't connect to self

    const node = hit.instance
    const ports = node.ports

    // Check if we hit a port
    if (hit.result.part === 'port' && hit.result.portId) {
      const port = ports.find(p => p.id === hit.result.portId)
      if (port) {
        // Validate: output → input or execution compatibility
        const sourcePort = this._getSourcePort()
        if (sourcePort && this._areCompatible(sourcePort, port)) {
          return { nodeId: node.id, portId: port.id }
        }
      }
    }

    return null
  }

  private _getSourcePort(): PortDefinition | undefined {
    if (!this._state.sourceId || !this._state.sourcePortId) return undefined
    const sourceInst = this._nodeRuntime?.get(this._state.sourceId)
    if (!sourceInst) return undefined
    return sourceInst.ports.find(p => p.id === this._state.sourcePortId)
  }

  /** Simple compatibility check: input ↔ output, or exec ↔ exec */
  private _areCompatible(a: PortDefinition, b: PortDefinition): boolean {
    const aOutput = a.direction === 'output' || a.direction === 'executionOutput'
    const bInput = b.direction === 'input' || b.direction === 'executionInput'
    const aInput = a.direction === 'input' || a.direction === 'executionInput'
    const bOutput = b.direction === 'output' || b.direction === 'executionOutput'

    // Must be one output → one input
    if (!((aOutput && bInput) || (aInput && bOutput))) return false

    // Optional: same dataType if both set
    if (a.dataType && b.dataType && a.dataType !== b.dataType) return false

    return true
  }

  private _reset(): void {
    this._state = {
      phase: 'idle',
      sourceId: null,
      sourcePortId: null,
      cursorPosition: { x: 0, y: 0 },
      validTargetId: null,
      validTargetPortId: null,
    }
    this._emitState()
  }

  private _emitState(): void {
    this._eventBus?.emit('builder:connection:changed', { ...this._state })
  }
}
