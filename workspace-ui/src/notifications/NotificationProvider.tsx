import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { notificationReducer } from './reducer'
import {
  type Notification,
  type NotificationType,
  type NotificationOptions,
  type NotificationState,
} from './types'

// ── Context ─────────────────────────────────────────────────────────

interface NotificationContextValue {
  state: NotificationState
  add: (type: NotificationType, title: string, description?: string, options?: NotificationOptions) => string
  dismiss: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  markSeen: () => void
  clearHistory: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────

let nextId = 1

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, {
    active: [],
    history: [],
    unseenCount: 0,
  })

  // Track timers so we can clean up on unmount
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const startTimer = useCallback((id: string, duration: number) => {
    const timer = setTimeout(() => {
      dispatch({ type: 'DISMISS', id })
      // Remove from DOM after animation
      setTimeout(() => dispatch({ type: 'REMOVE', id }), 300)
      timers.current.delete(id)
    }, duration)
    timers.current.set(id, timer)
  }, [])

  const add = useCallback(
    (type: NotificationType, title: string, description?: string, options?: NotificationOptions): string => {
      const defaults: NotificationOptions = {
        duration: type === 'error' ? 8000 : type === 'warning' ? 5000 : 4000,
        ...options,
      }

      const notification: Notification = {
        id: `notif-${nextId++}`,
        type,
        title,
        description,
        timestamp: Date.now(),
        options: defaults,
        dismissing: false,
      }

      dispatch({ type: 'ADD', notification })

      if (defaults.duration && defaults.duration > 0) {
        startTimer(notification.id, defaults.duration)
      }

      return notification.id
    },
    [startTimer],
  )

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id })
    // Cancel auto-dismiss timer
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
    // Remove from DOM after animation
    setTimeout(() => dispatch({ type: 'REMOVE', id }), 300)
  }, [])

  const remove = useCallback((id: string) => dispatch({ type: 'REMOVE', id }), [])
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), [])
  const markSeen = useCallback(() => dispatch({ type: 'MARK_SEEN' }), [])
  const clearHistory = useCallback(() => dispatch({ type: 'CLEAR_HISTORY' }), [])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) {
        clearTimeout(t)
      }
    }
  }, [])

  return (
    <NotificationContext.Provider
      value={{ state, add, dismiss, remove, clear, markSeen, clearHistory }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider')
  return ctx
}
