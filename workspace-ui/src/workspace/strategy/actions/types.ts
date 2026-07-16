// ── Action types ──
// Core types for the Action Engine.
//
// @since 3.4.5

/** Rich result from action execution */
export interface ActionResult {
  /** Whether the action completed successfully */
  success: boolean

  /** Order ID returned by the exchange (if applicable) */
  orderId?: string

  /** Position ID affected (if applicable) */
  positionId?: string

  /** Human-readable result message */
  message?: string

  /** Extended metadata for future extensions */
  metadata?: Record<string, unknown>
}

/** Action parameter schema */
export interface ActionParameter {
  id: string
  name: string
  type: 'number' | 'string' | 'boolean' | 'select'
  default: unknown
  description?: string
  options?: string[]
  min?: number
  max?: number
}

/** Action execution log entry */
export interface ActionLogEntry {
  actionId: string
  timestamp: number
  params: Record<string, unknown>
  result: ActionResult
}
