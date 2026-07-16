// ── Graph Editor — Sprint 3.6.3 ──
//
export { ConnectionManager } from './ConnectionManager'
export { EdgeRenderer } from './EdgeRenderer'
export { hitTestEdge, hitTestEdges } from './EdgeHitTester'
export { buildEdgeView, buildAllEdgeViews, computeControlPoints } from './EdgeView'
export { ClipboardManager } from './ClipboardManager'
export { AutoLayout } from './AutoLayout'
export { UndoAdapter } from './UndoAdapter'
export { registerGraphCommands } from './GraphCommands'
export { GraphEditorRuntime } from './GraphEditorRuntime'
export type {
  EdgeViewModel,
  EdgeStyle,
  ConnectionState,
  ConnectionPhase,
  ConnectionCandidate,
  LayoutNode,
  GraphSnapshot,
} from './types'
