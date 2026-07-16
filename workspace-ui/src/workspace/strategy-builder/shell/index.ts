// ── Shell — Sprint 3.6.4 Builder Shell ──
//
export { BuilderShellRuntime } from './BuilderShellRuntime'
export type { ShellRuntimes } from './BuilderShellRuntime'

// Palette
export { PaletteRuntime } from './palette/PaletteRuntime'
export { PaletteSearch } from './palette/PaletteSearch'
export { PaletteProvider } from './palette/PaletteProvider'
export type { DragPayload } from './palette/PaletteProvider'

// Inspector
export { InspectorRuntime } from './inspector/InspectorRuntime'
export type { InspectorState } from './inspector/InspectorRuntime'
export { PropertyEditorRegistry } from './inspector/PropertyEditorRegistry'
export type { PropertyEditor } from './inspector/PropertyEditorRegistry'
export { PropertyGrid } from './inspector/PropertyGrid'
export type { EditorBinding } from './inspector/PropertyGrid'

// Editors
export { NumberEditor, BooleanEditor, EnumEditor, TimeEditor, SymbolEditor } from './inspector/editors'

// MiniMap
export { MiniMapRuntime } from './minimap/MiniMapRuntime'
export type { MiniMapState, MiniMapViewport } from './minimap/MiniMapRuntime'
export { MiniMapRenderer } from './minimap/MiniMapRenderer'

// Search
export { SearchIndex } from './search/SearchIndex'
export { GraphSearch } from './search/GraphSearch'

// Outline
export { GraphOutline } from './outline/GraphOutline'
export type { GraphOutlineOptions } from './outline/GraphOutline'

// Types
export type {
  ParamValueType,
  ParameterDefinition,
  PaletteCategory,
  PaletteItem,
  SearchResult,
  OutlineEntry,
  ValidationMessage,
} from './types'
export { fromSignalParam } from './types'
