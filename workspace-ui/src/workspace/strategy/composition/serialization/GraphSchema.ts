// ── GraphSchema — JSON Schema for strategy graphs ──
//
// Schema version: 1.0.0
// Used for validation during import/export.
//
// @since 3.4.6

/**
 * JSON Schema for StrategyGraph validation.
 * Compatible with AJV or any JSON Schema Draft-07 validator.
 */
export const GRAPH_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://trading-workspace.local/strategy-graph.schema.json',
  title: 'StrategyGraph',
  description: 'A directed acyclic graph representing a trading strategy',
  type: 'object',
  required: ['id', 'name', 'version', 'nodes', 'edges'],
  properties: {
    id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
    name: { type: 'string', minLength: 1, maxLength: 128 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    description: { type: 'string', maxLength: 1024 },
    nodes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'type', 'definitionId'],
        properties: {
          id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
          type: { type: 'string', enum: ['signal', 'condition', 'action', 'group', 'comment'] },
          label: { type: 'string' },
          definitionId: { type: 'string' },
          params: { type: 'object' },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
            },
          },
          metadata: { type: 'object' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'sourceId', 'targetId'],
        properties: {
          id: { type: 'string' },
          sourceId: { type: 'string' },
          targetId: { type: 'string' },
          label: { type: 'string' },
          condition: { type: 'string' },
        },
      },
    },
    metadata: {
      type: 'object',
      properties: {
        created: { type: 'number' },
        updated: { type: 'number' },
        author: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        schedule: { type: 'string', enum: ['onBar', 'onTick', 'onTrade', 'onTimer', 'onNews', 'onCustomEvent'] },
      },
    },
    layout: { type: 'object' },
  },
} as const

/** Current schema version */
export const CURRENT_SCHEMA_VERSION = '1.0.0'
