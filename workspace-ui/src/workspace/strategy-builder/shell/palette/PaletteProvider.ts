// ── PaletteProvider — Drag source provider ──
//
// Provides palette items for drag-to-create workflow.
// The UI layer picks up the serialized item from drag data.
//
// @since 3.6.4

import type { PaletteItem, ParameterDefinition } from '../types'

export interface DragPayload {
  definitionId: string
  label: string
  type: string
  category: string
  params?: ParameterDefinition[]
}

export class PaletteProvider {
  /** Create a drag payload from a palette item */
  createDragPayload(item: PaletteItem): DragPayload {
    return {
      definitionId: item.id,
      label: item.label,
      type: item.type,
      category: item.category,
      params: item.params,
    }
  }

  /** Serialize drag payload for DataTransfer */
  serializePayload(payload: DragPayload): string {
    return JSON.stringify(payload)
  }

  /** Deserialize drag payload */
  deserializePayload(data: string): DragPayload | null {
    try {
      const parsed = JSON.parse(data)
      if (parsed && parsed.definitionId) return parsed as DragPayload
      return null
    } catch {
      return null
    }
  }

  /** Get the mime type used for drag events */
  get mimeType(): string {
    return 'application/x-builder-node'
  }
}
