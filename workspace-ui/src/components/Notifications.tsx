/* ═══════════════════════════════════════════════════════════════
   Notification Store + Component
   Spec: Workspace_UI_Architecture_v2.md §1.11, §3.4
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ErrorLevel } from '../widgets/types'

/* ── Types ── */

export interface Notification {
  id: string
  level: ErrorLevel
  title: string
  message: string
  autoClose?: number // ms, 0 = manual close
}

/* ── Color map ── */

const NOTIF_ICONS: Record<ErrorLevel, { bg: string; icon: string }> = {
  info:        { bg: 'var(--primary)', icon: 'i' },
  warning:     { bg: 'var(--warning)', icon: '!' },
  recoverable: { bg: 'var(--warning)', icon: '↻' },
  critical:    { bg: 'var(--danger)',  icon: '✕' },
  fatal:       { bg: 'var(--danger)',  icon: '‼' },
}

/* ── Context ── */

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id'>) => string
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

let nextId = 0
const genId = () => `notif_${++nextId}`

/* ── Provider ── */

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((n: Omit<Notification, 'id'>): string => {
    const id = genId()
    const autoClose = n.autoClose ?? 4000
    setNotifications((prev) => [...prev, { ...n, id }])
    if (autoClose > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((x) => x.id !== id))
      }, autoClose)
    }
    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const clearAll = useCallback(() => setNotifications([]), [])

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAll }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

/* ── Hook ── */

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider')
  return ctx
}

/* ── Toast List ── */

function NotificationContainer() {
  const { notifications, removeNotification } = useNotification()
  const [leaving, setLeaving] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (notifications.length === 0) setLeaving(new Set())
  }, [notifications.length])

  const handleClose = useCallback((id: string) => {
    setLeaving((prev) => new Set(prev).add(id))
    setTimeout(() => {
      removeNotification(id)
      setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n })
    }, 300)
  }, [removeNotification])

  if (notifications.length === 0) return null

  return (
    <div className="notification-container">
      {notifications.map((n) => {
        const style = NOTIF_ICONS[n.level]
        return (
          <div
            key={n.id}
            className={`notification-toast ${leaving.has(n.id) ? 'leaving' : ''}`}
          >
            <div className="notif-icon" style={{ background: style.bg, color: '#fff' }}>
              {style.icon}
            </div>
            <div className="notif-body">
              <div className="notif-title">{n.title}</div>
              <div className="notif-message">{n.message}</div>
            </div>
            <button className="notif-close" onClick={() => handleClose(n.id)}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
