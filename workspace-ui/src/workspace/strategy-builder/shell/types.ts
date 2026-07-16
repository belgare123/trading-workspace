// ── Shell types — Universal parameter definitions for Inspector ──
//
// PropertyEditorRegistry uses these types to select the right editor.
// Marketplace plugins add new types without modifying Builder core.
//
// @since 3.6.4

import type { SignalParameter } from '../../../workspace/strategy/signals/types'

export type ParamValueType = 'number' | 'string' | 'boolean' | 'select' | 'time' | 'symbol'

export interface ParameterDefinition {
  id: string
  label: string
  type: ParamValueType
  defaultValue: unknown
  description?: string
  min?: number
  max?: number
  step?: number
  options?: string[]       // for 'select' type
  placeholder?: string
  required?: boolean
}

/** Convert SignalParameter → ParameterDefinition (bridge) */
export function fromSignalParam(p: SignalParameter): ParameterDefinition {
  const mapping: Record<string, ParamValueType> = {
    number: 'number',
    string: 'string',
    boolean: 'boolean',
    select: 'select',
  }
  return {
    id: p.id,
    label: p.name,
    type: mapping[p.type] ?? 'string',
    defaultValue: p.default,
    description: p.description,
    min: p.min,
    max: p.max,
    options: p.options,
  }
}

export interface PaletteCategory {
  category: string
  items: PaletteItem[]
}

export interface PaletteItem {
  id: string
  label: string
  type: string        // 'signal' | 'condition' | 'action' | 'group' | 'comment'
  category: string
  description?: string
  icon?: string
  /** Parameter definitions for this item — used on drag-to-create */
  params?: ParameterDefinition[]
}

export interface SearchResult {
  id: string
  label: string
  type: string
  matchField: 'label' | 'params' | 'definitionId' | 'description'
  matchText: string
  score: number
}

export interface OutlineEntry {
  id: string
  label: string
  type: string
  depth: number
  expanded: boolean
  children: OutlineEntry[]
  metadata?: Record<string, string>
}

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info'
  text: string
  nodeId?: string
  edgeId?: string
}
