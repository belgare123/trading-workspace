// ── Strategy Builder root barrel ──
// Phase 3.6 Visual Builder
//
// @since 3.6.1

// ── Core Types ──
export type {
  Point2D, Box2D, InteractionEvent, DragState, SelectionState, RenderFrame,
} from './types'

// ── Canvas (3.6.1) ──
export { CanvasManager, type CanvasLayerHandle } from './canvas'
export { InteractionManager, type InteractionHandler } from './interaction'
export { SelectionManager, type Selectable } from './selection'
export { Renderer } from './rendering'
export { BuilderEventBus } from './runtime/BuilderEventBus'
export type { BuilderEventMap, BuilderEventName } from './runtime/BuilderEventBus'
export { StrategyBuilderRuntime } from './runtime/StrategyBuilderRuntime'

// ── Nodes (3.6.2) ──
export { NodeInstance, NodeRegistry, NodeFactory, NodeDefinition, NodeRuntime, NodeRenderer } from './nodes'
export type { INodeDefinition, NodeViewModel, NodeRenderContext, NodeHitTestResult, PortDefinition, PortDirection, NodeCategory } from './nodes'

// ── Graph Editor (3.6.3) ──
export { ConnectionManager, EdgeRenderer, hitTestEdge, hitTestEdges, buildEdgeView, buildAllEdgeViews, ClipboardManager, AutoLayout, UndoAdapter, registerGraphCommands, GraphEditorRuntime } from './graph-editor'
export type { EdgeViewModel, EdgeStyle, ConnectionState, ConnectionPhase, ConnectionCandidate, LayoutNode } from './graph-editor'

// ── Shell (3.6.4) ──
export { BuilderShellRuntime } from './shell/BuilderShellRuntime'
export type { ShellRuntimes } from './shell/BuilderShellRuntime'
export { PaletteRuntime, PaletteSearch, PaletteProvider } from './shell'
export type { DragPayload } from './shell'
export { InspectorRuntime, PropertyEditorRegistry, PropertyGrid } from './shell'
export type { InspectorState, PropertyEditor, EditorBinding } from './shell'
export { NumberEditor, BooleanEditor, EnumEditor, TimeEditor, SymbolEditor } from './shell'
export { MiniMapRuntime, MiniMapRenderer, SearchIndex, GraphSearch, GraphOutline } from './shell'
export type { MiniMapState, MiniMapViewport, GraphOutlineOptions } from './shell'
export type { ParamValueType, ParameterDefinition, PaletteCategory, PaletteItem, SearchResult, OutlineEntry, ValidationMessage } from './shell'
export { fromSignalParam } from './shell'
