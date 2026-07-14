import type { ReactNode } from 'react'

/** A command that the user can invoke from the command palette. */
export interface SdkCommand {
  /** Unique identifier (namespaced, e.g. 'my-plugin.action') */
  id: string
  /** Display title */
  title: string
  /** Optional subtitle / description */
  subtitle?: string
  /** Category for grouping */
  category?: string
  /** Optional keyboard shortcut hint */
  shortcut?: string
  /** Icon or emoji */
  icon?: string
  /** Execute handler */
  execute: (params?: Record<string, unknown>) => void | Promise<void>
}

/** A search adapter contributes results to the global search (Ctrl+Shift+F). */
export interface SdkSearchAdapter {
  /** Unique adapter ID */
  id: string
  /** Display name shown in domain pills */
  title: string
  /** Domain key (for filtering) */
  domain: string
  /** Search function — return results matching the query */
  search: (query: string) => Promise<Array<{ title: string; description?: string; url?: string; icon?: string }>>
}

/** A panel renders custom content in the right-side dock. */
export interface SdkPanel {
  /** Unique panel ID */
  id: string
  /** Display title shown in the panel header */
  title: string
  /** Optional icon (emoji or text) */
  icon?: string
  /** Panel content renderer */
  render: () => ReactNode
  /** Optional: panel width (default: 320) */
  width?: number
}

/** A timeline event that can be pushed into the timeline feed. */
export interface SdkTimelineEvent {
  id: string
  timestamp: number
  type: string
  title: string
  description?: string
}

/** A notification payload for SDK sinks. */
export interface SdkNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  timestamp: number
}
