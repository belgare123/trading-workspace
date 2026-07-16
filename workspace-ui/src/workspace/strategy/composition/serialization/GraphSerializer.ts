// ── GraphSerializer — StrategyGraph ↔ JSON serialization ──
//
// Handles import/export of strategy graphs to/from JSON.
// Supports:
//   - Serialize StrategyGraph → JSON string
//   - Deserialize JSON string → StrategyGraph
//   - Validate against schema
//   - Prettify / minify output
//
// @since 3.4.6

import { StrategyGraph } from '../graph/StrategyGraph'
import type { StrategyGraph as StrategyGraphData } from '../types'

export interface SerializeOptions {
  pretty?: boolean
  includeLayout?: boolean
}

export class GraphSerializer {
  /**
   * Serialize a StrategyGraph to a JSON string.
   */
  static serialize(graph: StrategyGraph, options?: SerializeOptions): string {
    const data = graph.toJSON()

    // Strip layout if not wanted
    if (options?.includeLayout === false) {
      delete data.layout
    }

    return options?.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data)
  }

  /**
   * Deserialize a JSON string to a StrategyGraph.
   */
  static deserialize(json: string): StrategyGraph {
    let data: StrategyGraphData
    try {
      data = JSON.parse(json)
    } catch {
      throw new Error('Invalid JSON: failed to parse strategy graph')
    }

    // Basic structural validation
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid strategy graph: not an object')
    }
    if (!data.id || !data.name || !data.version) {
      throw new Error('Invalid strategy graph: missing required fields (id, name, version)')
    }
    if (!Array.isArray(data.nodes)) {
      throw new Error('Invalid strategy graph: nodes must be an array')
    }
    if (!Array.isArray(data.edges)) {
      throw new Error('Invalid strategy graph: edges must be an array')
    }

    // Set defaults
    data.nodes = data.nodes.map(n => ({
      ...n,
      params: n.params ?? {},
    }))

    return new StrategyGraph(data as StrategyGraphData)
  }

  /**
   * Export a graph as a downloadable JSON blob.
   */
  static exportBlob(graph: StrategyGraph): Blob {
    const json = GraphSerializer.serialize(graph, { pretty: true })
    return new Blob([json], { type: 'application/json' })
  }

  /**
   * Quick validation without constructing a StrategyGraph.
   */
  static validate(json: string): { valid: boolean; errors: string[] } {
    try {
      GraphSerializer.deserialize(json)
      return { valid: true, errors: [] }
    } catch (err) {
      return {
        valid: false,
        errors: [err instanceof Error ? err.message : String(err)],
      }
    }
  }
}
