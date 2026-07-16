// ── Individual Property Editors ──
//
// Each editor is a thin render function registered in PropertyEditorRegistry.
// These files exist as separate modules so Marketplace plugins can import
// specific editor types without loading the full registry.
//
// @since 3.6.4

export const NumberEditor = {
  type: 'number' as const,
  label: 'Number',
  render: (param: any, value: any, _onChange: (v: unknown) => void): string => {
    const val = value ?? param.defaultValue ?? ''
    return `<input type="number" min="${param.min ?? ''}" max="${param.max ?? ''}" step="${param.step ?? '1'}" value="${val}" class="pe-number" />`
  },
  validate: (value: unknown, param: any): string | null => {
    const n = typeof value === 'number' ? value : parseFloat(String(value))
    if (isNaN(n)) return 'Must be a valid number'
    if (param.min !== undefined && n < param.min) return `Minimum ${param.min}`
    if (param.max !== undefined && n > param.max) return `Maximum ${param.max}`
    return null
  },
  parse: (input: string): unknown => {
    const n = parseFloat(input)
    return isNaN(n) ? input : n
  },
}

export const BooleanEditor = {
  type: 'boolean' as const,
  label: 'Boolean',
  render: (param: any, value: any, _onChange: (v: unknown) => void): string => {
    const checked = value ?? param.defaultValue ?? false
    return `<input type="checkbox" ${checked ? 'checked' : ''} class="pe-boolean" />`
  },
  validate: (): string | null => null,
  parse: (input: string): unknown => input === 'true' || input === 'checked',
}

export const EnumEditor = {
  type: 'select' as const,
  label: 'Dropdown',
  render: (param: any, value: any, _onChange: (v: unknown) => void): string => {
    const opts = (param.options ?? []).map((opt: string) =>
      `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`
    ).join('')
    return `<select class="pe-enum">${opts}</select>`
  },
  validate: (value: unknown, param: any): string | null => {
    if (param.options && !param.options.includes(value as string)) return 'Invalid option'
    return null
  },
  parse: (input: string): unknown => input,
}

export const TimeEditor = {
  type: 'time' as const,
  label: 'Time / Period',
  render: (param: any, value: any, _onChange: (v: unknown) => void): string => {
    const val = value ?? param.defaultValue ?? ''
    return `<input type="text" value="${val}" placeholder="e.g. 14, 1h, daily" class="pe-time" />`
  },
  validate: (): string | null => null,
  parse: (input: string): unknown => input,
}

export const SymbolEditor = {
  type: 'symbol' as const,
  label: 'Symbol',
  render: (param: any, value: any, _onChange: (v: unknown) => void): string => {
    const val = value ?? param.defaultValue ?? ''
    return `<input type="text" value="${val}" placeholder="e.g. BTC/USDT" class="pe-symbol" />`
  },
  validate: (): string | null => null,
  parse: (input: string): unknown => input.toUpperCase(),
}
