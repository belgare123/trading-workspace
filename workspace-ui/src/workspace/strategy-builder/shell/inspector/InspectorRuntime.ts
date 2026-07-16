// ── InspectorRuntime — Reads selected node params ──
//
// Watches the selected node and provides its ParameterDefinitions
// to the PropertyGrid. Does NOT know about RSI, MACD, Buy, etc.
//
// @since 3.6.4

import type { BuilderEventBus } from '../../runtime/BuilderEventBus'
import type { NodeRuntime } from '../../nodes/NodeRuntime'
import type { NodeRegistry } from '../../nodes/NodeRegistry'
import type { StrategyNode } from '../../../strategy/composition/types'
import type { ParameterDefinition, ValidationMessage } from '../types'
import { fromSignalParam } from '../types'

export interface InspectorState {
  selectedNodeId: string | null
  selectedNode: StrategyNode | null
  parameters: ParameterDefinition[]
  values: Record<string, unknown>
  valid: boolean
  errors: ValidationMessage[]
}

export class InspectorRuntime {
  private _eventBus: BuilderEventBus | null = null
  private _nodeRuntime: NodeRuntime | null = null
  private _nodeRegistry: NodeRegistry | null = null
  private _state: InspectorState = {
    selectedNodeId: null,
    selectedNode: null,
    parameters: [],
    values: {},
    valid: true,
    errors: [],
  }
  private _disposers: (() => void)[] = []

  connect(
    eventBus: BuilderEventBus,
    nodeRuntime: NodeRuntime,
    nodeRegistry: NodeRegistry,
  ): void {
    this._eventBus = eventBus
    this._nodeRuntime = nodeRuntime
    this._nodeRegistry = nodeRegistry

    // Watch node selection changes
    const off = eventBus.on('builder:nodes:changed', () => {
      this._refresh()
    })
    this._disposers.push(off)
  }

  /** Get current inspector state */
  get state(): Readonly<InspectorState> {
    return this._state
  }

  /** Check if inspector has a valid selection */
  get hasSelection(): boolean {
    return this._state.selectedNodeId !== null
  }

  /** Update a parameter value */
  setValue(paramId: string, value: unknown): void {
    if (!this._state.selectedNode) return
    this._state.selectedNode.params[paramId] = value
    this._state.values[paramId] = value

    // Validate
    this._validate()

    // Emit property changed event
    this._eventBus?.emit('builder:property:changed', {
      nodeId: this._state.selectedNodeId!,
      paramId,
      value,
    })

    // Emit node update
    this._eventBus?.emit('builder:nodes:changed', {
      updated: [this._state.selectedNodeId!],
    })
  }

  /** Set all values at once (from loaded config) */
  setValues(values: Record<string, unknown>): void {
    if (!this._state.selectedNode || !this._state.selectedNodeId) return
    for (const [key, val] of Object.entries(values)) {
      this._state.selectedNode.params[key] = val
      this._state.values[key] = val
    }
    this._validate()
    this._eventBus?.emit('builder:nodes:changed', {
      updated: [this._state.selectedNodeId],
    })
  }

  /** Destroy cleanup */
  destroy(): void {
    for (const fn of this._disposers) fn()
    this._disposers = []
  }

  // ── Private ──

  private _refresh(): void {
    const nodeRuntime = this._nodeRuntime
    if (!nodeRuntime) return

    // Find the first selected node
    const selected = nodeRuntime.getAll().find(inst => inst.selected)
    const nodeId = selected?.id ?? null
    const strategyNode = selected?.strategyNode ?? null

    let parameters: ParameterDefinition[] = []
    if (strategyNode && this._nodeRegistry) {
      const def = this._nodeRegistry.get(strategyNode.definitionId)
      if (def && typeof (def as any).getParameters === 'function') {
        const raw = (def as any).getParameters() as any[]
        if (Array.isArray(raw)) {
          parameters = raw.map((p: any) => {
            if (p.id !== undefined && p.type !== undefined) {
              return fromSignalParam(p)
            }
            return {
              id: String(p.id ?? ''),
              label: String(p.name ?? p.label ?? ''),
              type: (p.type as any) ?? 'string',
              defaultValue: p.default,
            }
          })
        }
      }
    }

    this._state = {
      selectedNodeId: nodeId,
      selectedNode: strategyNode,
      parameters,
      values: strategyNode?.params ?? {},
      valid: true,
      errors: [],
    }

    this._validate()
  }

  private _validate(): void {
    const errors: ValidationMessage[] = []
    for (const param of this._state.parameters) {
      const value = this._state.values[param.id]
      if (param.required && (value === undefined || value === null || value === '')) {
        errors.push({
          type: 'error',
          text: `${param.label} is required`,
          nodeId: this._state.selectedNodeId ?? undefined,
        })
      }
      if (param.type === 'number' && typeof value === 'number') {
        if (param.min !== undefined && value < param.min) {
          errors.push({
            type: 'error',
            text: `${param.label} must be ≥ ${param.min}`,
            nodeId: this._state.selectedNodeId ?? undefined,
          })
        }
        if (param.max !== undefined && value > param.max) {
          errors.push({
            type: 'error',
            text: `${param.label} must be ≤ ${param.max}`,
            nodeId: this._state.selectedNodeId ?? undefined,
          })
        }
      }
    }
    this._state = { ...this._state, errors, valid: errors.length === 0 }
    this._eventBus?.emit('builder:validation:updated', { errors, warnings: [] })
  }
}
