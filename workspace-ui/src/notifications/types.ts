/**
 * Notification types for the Workspace Notification Center.
 */

export type NotificationType = 'success' | 'warning' | 'error' | 'info'

export interface NotificationOptions {
  /** Auto-dismiss in ms. 0 = sticky (must be dismissed manually). Default: 4000 */
  duration?: number
  /** Optional action button */
  action?: { label: string; onClick: () => void }
  /** Optional source (e.g. 'system-monitor', 'plugin-store', 'ml-workbench') */
  source?: string
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  description?: string
  timestamp: number
  options: NotificationOptions
  /** True once the dismiss animation should play */
  dismissing: boolean
}

export interface NotificationState {
  /** Currently visible toasts */
  active: Notification[]
  /** Full history (keeps last 100) */
  history: Notification[]
  /** Unseen count (increments while toasts are dismissed before being read) */
  unseenCount: number
}

export type NotificationAction =
  | { type: 'ADD'; notification: Notification }
  | { type: 'DISMISS'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'CLEAR' }
  | { type: 'MARK_SEEN' }
  | { type: 'CLEAR_HISTORY' }
