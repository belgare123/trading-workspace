/** A saved workspace layout (workspace preset). */
export interface WorkspaceLayout {
  /** Unique identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Layout schema version for future migrations */
  layoutVersion: number

  /** View configuration */
  views: {
    /** Currently active view */
    active: string
    /** All opened views in order */
    opened: string[]
  }

  /** Panel visibility */
  panels: {
    inspector: boolean
    timeline: boolean
    sidebar: boolean
  }

  /** Panel sizes (pixels) */
  sizes: {
    sidebar: number
    inspector: number
    timeline: number
  }

  /** User preferences */
  preferences: {
    theme: 'dark'
    density: 'comfortable' | 'compact'
  }
}

/** Layout registry state */
export interface LayoutState {
  layouts: WorkspaceLayout[]
  activeId: string | null
  isDirty: boolean
}
