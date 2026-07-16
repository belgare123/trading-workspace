// ── BuilderShellRuntime — Coordination point for all shell components ──
//
// Single orchestrator that connects palette, inspector, minimap,
// search, and outline to the rest of the builder infrastructure.
//
// Panels communicate ONLY through BuilderShellRuntime — never directly.
//
// @since 3.6.4

import { BuilderEventBus } from '../runtime/BuilderEventBus'
import { NodeRuntime } from '../nodes/NodeRuntime'
import { NodeRegistry } from '../nodes/NodeRegistry'
import type { GraphEditorRuntime } from '../graph-editor/GraphEditorRuntime'
import type { StrategyGraph } from '../../strategy/composition/types'

import { PaletteRuntime } from './palette/PaletteRuntime'
import { PaletteSearch } from './palette/PaletteSearch'
import { PaletteProvider } from './palette/PaletteProvider'
import { InspectorRuntime } from './inspector/InspectorRuntime'
import { PropertyEditorRegistry } from './inspector/PropertyEditorRegistry'
import { PropertyGrid } from './inspector/PropertyGrid'
import { MiniMapRuntime } from './minimap/MiniMapRuntime'
import { MiniMapRenderer } from './minimap/MiniMapRenderer'
import { GraphSearch } from './search/GraphSearch'
import { SearchIndex } from './search/SearchIndex'
import { GraphOutline } from './outline/GraphOutline'

/** All shell sub-runtimes accessible for panel rendering */
export interface ShellRuntimes {
  palette: PaletteRuntime
  paletteSearch: PaletteSearch
  paletteProvider: PaletteProvider
  inspector: InspectorRuntime
  propertyEditorRegistry: PropertyEditorRegistry
  propertyGrid: PropertyGrid
  miniMap: MiniMapRuntime
  miniMapRenderer: MiniMapRenderer
  graphSearch: GraphSearch
  searchIndex: SearchIndex
  graphOutline: GraphOutline
}

export class BuilderShellRuntime {
  private _eventBus: BuilderEventBus

  readonly palette: PaletteRuntime
  readonly paletteSearch: PaletteSearch
  readonly paletteProvider: PaletteProvider
  readonly inspector: InspectorRuntime
  readonly propertyEditorRegistry: PropertyEditorRegistry
  readonly propertyGrid: PropertyGrid
  readonly miniMap: MiniMapRuntime
  readonly miniMapRenderer: MiniMapRenderer
  readonly graphSearch: GraphSearch
  readonly searchIndex: SearchIndex
  readonly graphOutline: GraphOutline

  constructor(
    eventBus: BuilderEventBus,
    nodeRuntime: NodeRuntime,
    nodeRegistry: NodeRegistry,
    _graphEditorRuntime?: GraphEditorRuntime,
  ) {
    this._eventBus = eventBus

    // ── Palette ──
    this.palette = new PaletteRuntime(nodeRegistry)
    this.paletteSearch = new PaletteSearch()
    this.paletteProvider = new PaletteProvider()
    this.palette.connect(eventBus)

    // ── Inspector ──
    this.inspector = new InspectorRuntime()
    this.propertyEditorRegistry = new PropertyEditorRegistry()
    this.propertyGrid = new PropertyGrid(this.inspector, this.propertyEditorRegistry)
    this.inspector.connect(eventBus, nodeRuntime, nodeRegistry)

    // ── MiniMap ──
    this.miniMap = new MiniMapRuntime()
    this.miniMapRenderer = new MiniMapRenderer()
    this.miniMap.connect(nodeRuntime)

    // ── Search ──
    this.searchIndex = new SearchIndex()
    this.graphSearch = new GraphSearch(this.searchIndex)
    this.graphSearch.connect(eventBus)

    // ── Outline ──
    this.graphOutline = new GraphOutline()

    // ── Wire events ──
    this._wireEvents()
  }

  /** Load a graph → update all shell components */
  loadGraph(graph: StrategyGraph): void {
    this.palette.refresh()
    this.graphSearch.loadGraph(graph)
    this.graphOutline.build(graph)
  }

  /** Refresh all panel states (e.g. after graph mutation) */
  refresh(): void {
    this.palette.refresh()
    this.propertyGrid.refresh()
  }

  /** Get all runtimes for panel rendering */
  get runtimes(): ShellRuntimes {
    return {
      palette: this.palette,
      paletteSearch: this.paletteSearch,
      paletteProvider: this.paletteProvider,
      inspector: this.inspector,
      propertyEditorRegistry: this.propertyEditorRegistry,
      propertyGrid: this.propertyGrid,
      miniMap: this.miniMap,
      miniMapRenderer: this.miniMapRenderer,
      graphSearch: this.graphSearch,
      searchIndex: this.searchIndex,
      graphOutline: this.graphOutline,
    }
  }

  /** Search the graph and return to palette */
  search(query: string): void {
    const results = this.graphSearch.search(query)
    this._eventBus.emit('builder:search:changed', { query, results })
  }

  /** Destroy all shell components */
  destroy(): void {
    this.inspector.destroy()
  }

  // ── Private ──

  private _wireEvents(): void {
    // When graph changes, refresh search index
    this._eventBus.on('builder:graph:changed', () => {
      this.searchIndex.markDirty()
    })

    // When nodes change, refresh property grid selection
    this._eventBus.on('builder:nodes:changed', (_data) => {
      this.propertyGrid.refresh()
    })
  }
}
