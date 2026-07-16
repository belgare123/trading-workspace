// ── PropertyGrid — Renders editors for currently selected node ──
//
// Reads InspectorRuntime state and delegates to PropertyEditorRegistry.
// Pure rendering coordination — no direct DOM manipulation in this layer.
//
// @since 3.6.4

import type { InspectorRuntime } from './InspectorRuntime'
import type { PropertyEditorRegistry } from './PropertyEditorRegistry'
import type { ParameterDefinition } from '../types'

export interface EditorBinding {
  param: ParameterDefinition
  value: unknown
  editor: ReturnType<PropertyEditorRegistry['getEditorFor']>
  error: string | null
}

export class PropertyGrid {
  private _registry: PropertyEditorRegistry
  private _inspector: InspectorRuntime
  private _bindings: EditorBinding[] = []

  constructor(inspector: InspectorRuntime, registry: PropertyEditorRegistry) {
    this._inspector = inspector
    this._registry = registry
  }

  /** Refresh bindings from current inspector state */
  refresh(): void {
    const state = this._inspector.state
    this._bindings = state.parameters.map(param => {
      const editor = this._registry.getEditorFor(param)
      const value = state.values[param.id] ?? param.defaultValue
      let error: string | null = null
      if (editor && value !== undefined) {
        error = editor.validate(value, param)
      }
      return { param, value, editor, error }
    })
  }

  /** All current bindings for rendering */
  get bindings(): EditorBinding[] {
    return this._bindings
  }

  /** Has any visible editor */
  get hasEditors(): boolean {
    return this._bindings.length > 0
  }

  /** Set a value via editor binding index */
  setValue(index: number, rawInput: string): void {
    const binding = this._bindings[index]
    if (!binding || !binding.editor) return
    const parsed = binding.editor.parse(rawInput, binding.param)
    this._inspector.setValue(binding.param.id, parsed)
    binding.value = parsed
    binding.error = binding.editor.validate(parsed, binding.param)
  }

  /** Get validation errors summary */
  get errors(): string[] {
    return this._bindings
      .filter(b => b.error)
      .map(b => `${b.param.label}: ${b.error}`)
  }
}
