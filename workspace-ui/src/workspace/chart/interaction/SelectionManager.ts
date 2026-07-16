// ── SelectionManager — owns hovered/selected/active state ──
// Pure state container. No canvas, no math, no rendering.
// Selection is tracked by instance id string.

export class SelectionManager {
  /** Currently hovered instance id (under pointer) */
  private _hoveredId: string | null = null

  /** Currently selected instance ids (multi-select via shift) */
  private _selectedIds: string[] = []

  /** Actively manipulated instance id (being dragged/resized) */
  private _activeId: string | null = null

  // ── Hover ──

  get hoveredId(): string | null {
    return this._hoveredId
  }

  setHover(id: string | null): void {
    this._hoveredId = id
  }

  // ── Selection ──

  get selectedIds(): readonly string[] {
    return this._selectedIds
  }

  /** Select a single instance (replaces all other selections) */
  select(id: string): void {
    this._selectedIds = [id]
  }

  /** Add to selection (shift-click) */
  addToSelection(id: string): void {
    if (!this._selectedIds.includes(id)) {
      this._selectedIds.push(id)
    }
  }

  /** Deselect a specific instance */
  deselect(id: string): void {
    this._selectedIds = this._selectedIds.filter((s) => s !== id)
  }

  /** Clear all selections */
  clearSelection(): void {
    this._selectedIds = []
  }

  /** Check if an instance is selected */
  isSelected(id: string): boolean {
    return this._selectedIds.includes(id)
  }

  // ── Active ──

  get activeId(): string | null {
    return this._activeId
  }

  /** Set the actively manipulated instance */
  setActive(id: string | null): void {
    this._activeId = id
  }

  /** Clear all state */
  reset(): void {
    this._hoveredId = null
    this._selectedIds = []
    this._activeId = null
  }
}
