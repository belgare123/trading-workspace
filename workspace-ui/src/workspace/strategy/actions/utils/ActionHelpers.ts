// ── ActionHelpers — utilities for action execution ──
// Pure helper functions for the Action Engine.
// No state, no side effects.
//
// @since 3.4.5

import type { OrderResult } from '../../context'

/**
 * Build a success ActionResult from an OrderResult.
 */
export function orderSuccess(order: OrderResult, message?: string): { success: true; orderId: string; message: string } {
  return {
    success: true,
    orderId: order.id,
    message: message ?? `Order ${order.id} placed: ${order.side} ${order.quantity} ${order.symbol} @ ${order.price}`,
  }
}

/**
 * Build a failure ActionResult.
 */
export function actionError(message: string): { success: false; message: string } {
  return { success: false, message }
}

/**
 * Validate that a required parameter is present and of the right type.
 */
export function requireParam(
  params: Record<string, unknown>,
  key: string,
  type: 'string' | 'number' | 'boolean',
): string | null {
  const val = params[key]
  if (val == null) {
    return `Missing required parameter: ${key}`
  }
  if (typeof val !== type) {
    return `Parameter ${key} must be of type ${type}, got ${typeof val}`
  }
  return null
}

/**
 * Resolve a numeric parameter with optional default.
 */
export function numberParam(
  params: Record<string, unknown>,
  key: string,
  defaultVal: number,
): number {
  const val = params[key]
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const parsed = parseFloat(val)
    return isNaN(parsed) ? defaultVal : parsed
  }
  return defaultVal
}

/**
 * Resolve a string parameter with optional default.
 */
export function stringParam(
  params: Record<string, unknown>,
  key: string,
  defaultVal: string,
): string {
  const val = params[key]
  if (typeof val === 'string') return val
  return defaultVal
}
