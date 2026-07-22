/**
 * WrappedWebSocket.ts — WebSocket wrapper that injects failures transparently
 *
 * Wraps a native WebSocket so that connect, disconnect, and message events
 * pass through the FailureInjector. Existing code continues to use the
 * same WebSocket API without any changes.
 *
 * The wrapper intercepts:
 *   - connect (new WebSocket): may inject latency, timeout, connection_refused
 *   - onmessage: may inject packet_loss, partial_response, malformed_response
 *   - onclose: may inject disconnect or reconnect delays
 *
 * Sprint 6.6.3 adds full IFailureObserver / ChaosTraceRuntime integration
 * so every injection creates a structured trace.
 *
 * @since 6.6
 */

import type { FailureInjector } from './FailureInjector'
import { FailureInjectionScope } from './InjectionRule'
import type { IFailureObserver } from './IFailureObserver'

// ── WebSocket state enum ──

type WsState = 'connecting' | 'open' | 'closing' | 'closed'

// ── Event handler types ──

type WsEventListener = ((event: Event) => void) | null
type WsMessageListener = ((event: MessageEvent) => void) | null
type WsErrorListener = ((event: Event) => void) | null
type WsCloseListener = ((event: CloseEvent) => void) | null

/** WebSocket-like API but with chaos injection support */
export class WrappedWebSocket {
  private injector: FailureInjector
  private _url: string
  private protocols?: string | string[]
  private traceObserver: IFailureObserver | null

  private rawSocket: WebSocket | null = null
  private state: WsState = 'closed'

  // Active trace ID and action type for the current connection
  private activeChaosTraceId: string | null = null
  private activeChaosActionType: string | null = null

  // Event handlers (proxy to real socket when not injected)
  onopen: WsEventListener = null
  onclose: WsCloseListener = null
  onerror: WsErrorListener = null
  onmessage: WsMessageListener = null

  // Internal handler references (for cleanup)
  private boundOnOpen: ((event: Event) => void) | null = null
  private boundOnClose: ((event: CloseEvent) => void) | null = null
  private boundOnError: ((event: Event) => void) | null = null
  private boundOnMessage: ((event: MessageEvent) => void) | null = null

  constructor(
    url: string,
    injector: FailureInjector,
    traceObserver?: IFailureObserver,
    protocols?: string | string[],
  ) {
    this._url = url
    this.injector = injector
    this.traceObserver = traceObserver ?? null
    this.protocols = protocols
  }

  // ── Standard WebSocket API ──

  get url(): string {
    return this._url
  }

  get readyState(): number {
    if (this.state === 'connecting') return WebSocket.CONNECTING
    if (this.state === 'open') return WebSocket.OPEN
    if (this.state === 'closing') return WebSocket.CLOSING
    return WebSocket.CLOSED
  }

  get protocol(): string {
    return this.rawSocket?.protocol ?? ''
  }

  get extensions(): string {
    return this.rawSocket?.extensions ?? ''
  }

  get bufferedAmount(): number {
    return this.rawSocket?.bufferedAmount ?? 0
  }

  get binaryType(): BinaryType {
    return this.rawSocket?.binaryType ?? 'blob'
  }

  set binaryType(type: BinaryType) {
    if (this.rawSocket) this.rawSocket.binaryType = type
  }

  // ── Connection management ──

  async connect(): Promise<void> {
    if (this.state === 'open' || this.state === 'connecting') return

    const scope = this.url.includes('private') ? FailureInjectionScope.PRIVATE_WS
      : FailureInjectionScope.PUBLIC_WS

    const context = {
      scope,
      url: this.url,
      timestamp: Date.now(),
    }

    const action = await this.injector.evaluate(context)

    switch (action.type) {
      case 'connection_refused':
        this.state = 'closed'
        this.traceError(context, action, action.message ?? 'Chaos: connection refused')
        this.fireError(new Error(action.message ?? 'Chaos: connection refused'))
        return

      case 'timeout':
        this.state = 'closed'
        this.traceError(context, action, 'Chaos: connection timeout')
        this.fireError(new Error('Chaos: connection timeout'))
        return

      case 'latency':
        this.traceStart(context, action)
        await sleep(action.duration)
        this.traceEffect(context, action, { durationMs: action.duration })
        break // proceed to connect
    }

    await this.createRealSocket(context)
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.rawSocket && this.state === 'open') {
      const scope = this.url.includes('private') ? FailureInjectionScope.PRIVATE_WS
        : FailureInjectionScope.PUBLIC_WS

      const context = {
        scope,
        url: this.url,
        timestamp: Date.now(),
      }

      const action = this.injector.evaluateSync(context)

      if (action.type === 'packet_loss') {
        this.traceEvent(context, action, 'effect', 'packet_loss on send')
        return // drop silently
      }

      this.rawSocket.send(data)
    }
  }

  close(code?: number, reason?: string): void {
    if (this.rawSocket) {
      this.state = 'closing'
      this.rawSocket.close(code ?? 1000, reason ?? 'Normal closure')
    }
  }

  // ── Private ──

  private async createRealSocket(context: { url: string; scope: FailureInjectionScope }): Promise<void> {
    this.state = 'connecting'

    const ws = this.protocols
      ? new WebSocket(this.url, this.protocols)
      : new WebSocket(this.url)
    this.rawSocket = ws

    return new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        ws.close()
        reject(new Error('Chaos: WebSocket connect timeout'))
      }, 30_000)

      ws.onopen = (event: Event) => {
        clearTimeout(connectTimeout)
        this.state = 'open'
        this.traceComplete(context, { type: 'none' })
        // Evaluate rules for post-connect injection (disconnect, reconnect)
        this.evaluateAndInjectDisconnect(context)
        this.boundOnOpen?.(event)
        if (this.onopen) this.onopen(event)
        resolve()
      }

      ws.onclose = (event: CloseEvent) => {
        clearTimeout(connectTimeout)
        this.state = 'closed'
        this.boundOnClose?.(event)
        if (this.onclose) this.onclose(event)
      }

      ws.onerror = (event: Event) => {
        clearTimeout(connectTimeout)
        this.boundOnError?.(event)
        if (this.onerror) this.onerror(event)
      }

      ws.onmessage = (event: MessageEvent) => {
        const action = this.injector.evaluateSync({
          ...context,
          timestamp: Date.now(),
        })

        switch (action.type) {
          case 'packet_loss': {
            this.traceEvent(context, action, 'effect', 'packet_loss on message')
            return // drop message
          }

          case 'partial_response': {
            this.traceEvent(context, action, 'effect', `partial_response size=${action.size}`)
            const partialEvent = createPartialMessageEvent(event, action.size)
            this.boundOnMessage?.(partialEvent)
            this.onmessage?.(partialEvent)
            return
          }

          case 'malformed_response': {
            this.traceEvent(context, action, 'effect', `malformed_response`)
            const malformedEvent = createMalformedMessageEvent(event, action.payload)
            this.boundOnMessage?.(malformedEvent)
            this.onmessage?.(malformedEvent)
            return
          }

          default:
            this.boundOnMessage?.(event)
            if (this.onmessage) this.onmessage(event)
        }
      }
    })
  }

  private evaluateAndInjectDisconnect(context: { url: string; scope: FailureInjectionScope }): void {
    const action = this.injector.evaluateSync({
      ...context,
      timestamp: Date.now(),
    })

    if (action.type === 'disconnect' && this.rawSocket) {
      this.traceStart(context, action)
      setTimeout(() => {
        this.traceEffect(context, action, {})
        this.rawSocket?.close(1006, 'Chaos: injected disconnect')
        this.activeChaosTraceId = null
        this.activeChaosActionType = null
      }, 100)
    }

    if (action.type === 'reconnect' && this.rawSocket) {
      this.traceStart(context, action)
      setTimeout(() => {
        this.traceEffect(context, action, {})
        this.rawSocket?.close(1006, 'Chaos: injected reconnect')
        // After close fires, attempt reconnect
        setTimeout(() => {
          this.traceComplete(context, action)
          this.connect()
        }, action.delay)
      }, 100)
    }
  }

  private fireError(error: Error): void {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  // ── ChaosTrace lifecycle ──

  private generateTraceId(): string {
    return `ws-chaos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  private traceStart(
    context: { scope: FailureInjectionScope; url: string; timestamp: number },
    action: { type: string },
  ): void {
    if (!this.traceObserver) return
    const traceId = this.generateTraceId()
    this.activeChaosTraceId = traceId
    this.activeChaosActionType = action.type
    this.traceObserver.onChaosTrace({
      id: traceId,
      correlationTraceId: undefined,
      scope: context.scope,
      actionType: action.type,
      startedAt: Date.now(),
      status: 'running',
    })
    this.traceObserver.onChaosEvent({
      traceId,
      timestamp: Date.now(),
      phase: 'started',
      message: `${action.type} on WS connect`,
    })
  }

  private traceEffect(
    context: { scope: FailureInjectionScope; url: string; timestamp: number },
    action: { type: string },
    data?: Record<string, unknown>,
  ): void {
    if (!this.traceObserver || !this.activeChaosTraceId) return
    this.traceObserver.onChaosEvent({
      traceId: this.activeChaosTraceId,
      timestamp: Date.now(),
      phase: 'effect',
      message: `${action.type} applied`,
      data,
    })
  }

  private traceComplete(
    context: { scope: FailureInjectionScope; url: string; timestamp: number },
    _action: { type: string },
  ): void {
    if (!this.traceObserver || !this.activeChaosTraceId) return
    const traceId = this.activeChaosTraceId
    const actionType = this.activeChaosActionType ?? _action.type
    this.traceObserver.onChaosEvent({
      traceId,
      timestamp: Date.now(),
      phase: 'finished',
      message: `${actionType} complete`,
    })
    this.traceObserver.onChaosTrace({
      id: traceId,
      correlationTraceId: undefined,
      scope: context.scope,
      actionType,
      startedAt: context.timestamp,
      finishedAt: Date.now(),
      status: 'completed',
    })
    this.activeChaosTraceId = null
    this.activeChaosActionType = null
  }

  private traceEvent(
    context: { scope: FailureInjectionScope; url: string; timestamp: number },
    action: { type: string },
    phase: 'matched' | 'started' | 'effect' | 'finished' | 'recovered',
    message: string,
  ): void {
    if (!this.traceObserver) return
    // For per-message injections without a pre-created trace, create one on the fly
    const traceId = this.activeChaosTraceId ?? this.generateTraceId()
    const isNew = !this.activeChaosTraceId

    if (isNew) {
      this.activeChaosTraceId = traceId
      this.traceObserver.onChaosTrace({
        id: traceId,
        correlationTraceId: undefined,
        scope: context.scope,
        actionType: action.type,
        startedAt: Date.now(),
        status: 'running',
      })
    }

    this.traceObserver.onChaosEvent({
      traceId,
      timestamp: Date.now(),
      phase,
      message,
    })

    // For single-shot per-message events, complete immediately
    if (isNew) {
      this.activeChaosTraceId = null
      this.traceObserver.onChaosTrace({
        id: traceId,
        correlationTraceId: undefined,
        scope: context.scope,
        actionType: action.type,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        status: 'completed',
      })
    }
  }

  private traceError(
    context: { scope: FailureInjectionScope; url: string; timestamp: number },
    action: { type: string },
    message: string,
  ): void {
    if (!this.traceObserver) return
    const traceId = this.generateTraceId()
    this.traceObserver.onChaosTrace({
      id: traceId,
      correlationTraceId: undefined,
      scope: context.scope,
      actionType: action.type,
      startedAt: Date.now(),
      finishedAt: Date.now(),
      status: 'failed',
    })
    this.traceObserver.onChaosEvent({
      traceId,
      timestamp: Date.now(),
      phase: 'effect',
      message,
    })
  }
}

// ── Helpers ──

function createPartialMessageEvent(original: MessageEvent, size: number): MessageEvent {
  const originalData = typeof original.data === 'string' ? original.data : String(original.data)
  const truncated = originalData.slice(0, size)
  return new MessageEvent('message', {
    data: truncated,
    origin: original.origin,
    lastEventId: original.lastEventId,
    source: original.source,
    ports: original.ports,
  })
}

function createMalformedMessageEvent(original: MessageEvent, payload: string): MessageEvent {
  return new MessageEvent('message', {
    data: payload,
    origin: original.origin,
    lastEventId: original.lastEventId,
    source: original.source,
    ports: original.ports,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
