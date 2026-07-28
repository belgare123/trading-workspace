/**
 * EventBus.ts — 2.0.6 Workspace EventBus.
 *
 * Lightweight event emitter for UI-layer communication.
 * Completely separate from Runtime EventBus — this is the
 * "Workspace EventBus" layer that sits between ViewModel and Panels.
 *
 * Chain: Runtime → Projection → ViewModel → Workspace EventBus → Panels
 */

import type { WorkspaceEventBus, WorkspaceEventType, WorkspaceEvent } from './types'

type HandlerMap = Map<WorkspaceEventType, Set<(event: WorkspaceEvent) => void>>

export function createWorkspaceEventBus(): WorkspaceEventBus {
  const handlers: HandlerMap = new Map()

  function getHandlers(type: WorkspaceEventType): Set<(event: WorkspaceEvent) => void> {
    let set = handlers.get(type)
    if (!set) {
      set = new Set()
      handlers.set(type, set)
    }
    return set
  }

  return {
    on(type, handler) {
      getHandlers(type).add(handler)
      return () => {
        getHandlers(type).delete(handler)
      }
    },

    once(type, handler) {
      const wrapper = (event: WorkspaceEvent) => {
        handler(event)
        getHandlers(type).delete(wrapper)
      }
      getHandlers(type).add(wrapper)
      return () => {
        getHandlers(type).delete(wrapper)
      }
    },

    emit(type, payload?) {
      const event: WorkspaceEvent = { type, timestamp: Date.now(), payload }
      const set = handlers.get(type)
      if (set) {
        // Iterate over a copy to avoid issues if handler unsubscribes during iteration
        for (const handler of [...set]) {
          try {
            handler(event)
          } catch (err) {
            console.error(`[WorkspaceEventBus] Error in handler for ${type}:`, err)
          }
        }
      }
    },

    clear(type) {
      if (type) {
        handlers.delete(type)
      } else {
        handlers.clear()
      }
    },
  }
}
