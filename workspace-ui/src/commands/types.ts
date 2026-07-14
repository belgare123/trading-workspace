import type { ReactNode } from 'react'

/** A command in the Workspace Command Registry. */
export interface Command {
  /** Unique identifier, e.g. 'inspector.open' */
  id: string

  /** Human-readable title */
  title: string

  /** Optional subtitle / description */
  subtitle?: string

  /** Optional icon */
  icon?: ReactNode

  /** Category for grouping (Navigation, Replay, Inspector, etc.) */
  category?: string

  /** Alternative search keywords */
  keywords?: string[]

  /** Keyboard shortcut label (for display), e.g. 'Ctrl+Shift+R' */
  shortcut?: string

  /** Whether the command is currently enabled (default: true) */
  enabled?: () => boolean

  /** Whether the command is visible in the palette (default: true) */
  visible?: () => boolean

  /** Execute the command. May optionally accept params. */
  run: (params?: Record<string, unknown>) => void | Promise<void>
}

/** Payload for the command execution log. */
export interface CommandLogEntry {
  commandId: string
  title: string
  timestamp: number
}

/** State exposed by the CommandProvider. */
export interface CommandState {
  /** Whether the command palette is open */
  paletteOpen: boolean
  /** Search query text */
  query: string
  /** Commands matching the current query */
  results: Command[]
  /** Last N executed commands */
  history: CommandLogEntry[]
}
