/**
 * WebSocketFactory.ts — DI factory for WebSocket creation
 *
 * Enables injection of WrappedWebSocket (with chaos) into production
 * adapters WITHOUT feature flags or conditional branches in the adapter itself.
 *
 * Production path:
 *   BybitFeedAdapter → NativeWebSocketFactory → new WebSocket(url)
 *
 * Chaos path:
 *   BybitFeedAdapter → ChaosWebSocketFactory → new WrappedWebSocket(url, injector)
 *
 * @since 6.6.3a
 */

import { WrappedWebSocket } from './WrappedWebSocket'
import type { FailureInjector } from './FailureInjector'
import type { IFailureObserver } from './IFailureObserver'

/**
 * Factory that creates WebSocket instances.
 * Implementations hide the difference between native WebSocket and
 * WrappedWebSocket behind a uniform interface.
 */
export interface IWebSocketFactory {
  /** Create a WebSocket that starts connecting immediately. */
  createWebSocket(url: string): WebSocket
}

/**
 * Default production factory — creates a native WebSocket.
 * Used as the default fallback when no factory is injected.
 */
export class NativeWebSocketFactory implements IWebSocketFactory {
  createWebSocket(url: string): WebSocket {
    return new WebSocket(url)
  }
}

/**
 * Chaos factory — creates a WrappedWebSocket that runs the failure injector
 * during connect() and over the message lifecycle.
 *
 * The WrappedWebSocket's connect() is called fire-and-forget so that the
 * adapter can attach handlers (onopen, onmessage, etc.) before the async
 * connection resolves — same pattern as native WebSocket.
 */
export class ChaosWebSocketFactory implements IWebSocketFactory {
  constructor(
    private injector: FailureInjector,
    private observer?: IFailureObserver,
  ) {}

  createWebSocket(url: string): WebSocket {
    const ws = new WrappedWebSocket(url, this.injector, this.observer)
    // Fire connect() without awaiting — the WrappedWebSocket will resolve
    // asynchronously and fire onopen when the underlying socket opens.
    ws.connect()
    return ws as unknown as WebSocket
  }
}
