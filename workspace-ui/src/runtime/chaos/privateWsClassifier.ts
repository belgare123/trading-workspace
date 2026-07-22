/**
 * privateWsClassifier.ts — Bybit Private WS message classifier
 *
 * Maps Bybit private WebSocket message topics to FailureInjectionScope
 * categories for per-category chaos injection.
 *
 * Bybit private WS message format:
 *   { type: 'snapshot' | 'delta', topic: 'order' | 'execution' | 'position' | 'wallet', data: [...] }
 *
 * @since 6.6.4
 */

import { FailureInjectionScope } from './InjectionRule'
import type { CategoryClassifier } from './WrappedWebSocket'

/**
 * Create a CategoryClassifier for Bybit private WebSocket messages.
 *
 * Maps:
 *   'order'      → PRIVATE_WS_ORDER
 *   'execution'  → PRIVATE_WS_EXECUTION
 *   'position'   → PRIVATE_WS_POSITION
 *   'wallet'     → PRIVATE_WS_WALLET
 *   fallback     → PRIVATE_WS (umbrella)
 */
export function createBybitCategoryClassifier(): CategoryClassifier {
  return (message: unknown): FailureInjectionScope => {
    const msg = message as Record<string, unknown>

    // Bybit WS messages carry the topic in the 'topic' field.
    // E.g. { type: 'snapshot', topic: 'order', data: [...] }
    if (msg && typeof msg === 'object') {
      const topic = msg.topic
      if (typeof topic === 'string') {
        switch (topic) {
          case 'order':
            return FailureInjectionScope.PRIVATE_WS_ORDER
          case 'execution':
            return FailureInjectionScope.PRIVATE_WS_EXECUTION
          case 'position':
            return FailureInjectionScope.PRIVATE_WS_POSITION
          case 'wallet':
            return FailureInjectionScope.PRIVATE_WS_WALLET
          // Allow future account-scoped events
          case 'account':
            return FailureInjectionScope.PRIVATE_WS_ACCOUNT
        }
      }
    }

    // Auth responses, pong, subscription acks, or unknown topics
    // are classified as the umbrella Private WS scope
    return FailureInjectionScope.PRIVATE_WS
  }
}
