// ── PropertyEditorRegistry — Type → Editor mapping ──
//
// Single source of truth for which editor handles which parameter type.
// Marketplace can register custom editors without modifying Builder.
//
// @since 3.6.4

import type { ParamValueType, ParameterDefinition } from '../types'

export interface PropertyEditor {
  /** Type identifier this editor handles */
  type: ParamValueType | string
  /** Editor label */
  label: string
  /** Render function — returns an HTML string representation or component data */
  render(param: ParameterDefinition, value: unknown, onChange: (value: unknown) => void): string
  /** Validate a value for this editor */
  validate(value: unknown, param: ParameterDefinition): string | null
  /** Parse user input string → typed value */
  parse(input: string, param: ParameterDefinition): unknown
}

export class PropertyEditorRegistry {
  private _editors = new Map<string, PropertyEditor>()
  private _defaultEditor: PropertyEditor | null = null

  constructor() {
    this._registerDefaults()
  }

  /** Register an editor for a type */
  register(editor: PropertyEditor): void {
    this._editors.set(editor.type, editor)
  }

  /** Get editor for a parameter type */
  getEditor(type: ParamValueType | string): PropertyEditor | null {
    return this._editors.get(type) ?? this._defaultEditor
  }

  /** Get editor for a specific parameter definition */
  getEditorFor(param: ParameterDefinition): PropertyEditor | null {
    return this.getEditor(param.type)
  }

  /** All registered editors */
  get allEditors(): PropertyEditor[] {
    return Array.from(this._editors.values())
  }

  /** Set fallback editor for unknown types */
  setDefaultEditor(editor: PropertyEditor): void {
    this._defaultEditor = editor
  }

  private _registerDefaults(): void {
    this.register({
      type: 'number',
      label: 'Number',
      render: (param, value, _onChange) => {
        const val = value ?? param.defaultValue ?? ''
        return `<input type="number" min="${param.min ?? ''}" max="${param.max ?? ''}" step="${param.step ?? '1'}" value="${val}" data-param-id="${param.id}" />`
      },
      validate: (value, param) => {
        if (typeof value !== 'number' && typeof value !== 'string') return 'Must be a number'
        const n = typeof value === 'number' ? value : parseFloat(value)
        if (isNaN(n)) return 'Must be a valid number'
        if (param.min !== undefined && n < param.min) return `Minimum ${param.min}`
        if (param.max !== undefined && n > param.max) return `Maximum ${param.max}`
        return null
      },
      parse: (input) => {
        const n = parseFloat(input)
        return isNaN(n) ? input : n
      },
    })

    this.register({
      type: 'boolean',
      label: 'Boolean',
      render: (param, value, _onChange) => {
        const checked = value ?? param.defaultValue ?? false
        return `<input type="checkbox" ${checked ? 'checked' : ''} data-param-id="${param.id}" />`
      },
      validate: () => null,
      parse: (input) => input === 'true' || input === 'checked',
    })

    this.register({
      type: 'select',
      label: 'Dropdown',
      render: (param, value, _onChange) => {
        const opts = (param.options ?? []).map(opt =>
          `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`
        ).join('')
        return `<select data-param-id="${param.id}">${opts}</select>`
      },
      validate: (value, param) => {
        if (param.options && !param.options.includes(value as string)) return 'Invalid option'
        return null
      },
      parse: (input) => input,
    })

    this.register({
      type: 'string',
      label: 'Text',
      render: (param, value, _onChange) => {
        const val = value ?? param.defaultValue ?? ''
        return `<input type="text" value="${val}" placeholder="${param.placeholder ?? ''}" data-param-id="${param.id}" />`
      },
      validate: () => null,
      parse: (input) => input,
    })

    this.register({
      type: 'time',
      label: 'Time / Period',
      render: (param, value, _onChange) => {
        const val = value ?? param.defaultValue ?? ''
        return `<input type="text" value="${val}" placeholder="e.g. 14, 1h, daily" data-param-id="${param.id}" />`
      },
      validate: () => null,
      parse: (input) => input,
    })

    this.register({
      type: 'symbol',
      label: 'Symbol',
      render: (param, value, _onChange) => {
        const val = value ?? param.defaultValue ?? ''
        return `<input type="text" value="${val}" placeholder="e.g. BTC/USDT" data-param-id="${param.id}" />`
      },
      validate: () => null,
      parse: (input) => input.toUpperCase(),
    })
  }
}
