// ── StepController — Step-through execution mode ──
//
// Allows walking through the backtest one bar at a time.
//
// @since 3.5.3

export class StepController {
  private _breakpoints: Set<number> = new Set()
  private _onBreakpoint: ((barIndex: number) => void) | null = null

  onBreakpoint(cb: (barIndex: number) => void): void {
    this._onBreakpoint = cb
  }

  /** Add a breakpoint at bar index */
  addBreakpoint(index: number): void {
    this._breakpoints.add(index)
  }

  /** Remove a breakpoint */
  removeBreakpoint(index: number): void {
    this._breakpoints.delete(index)
  }

  /** Check if index is a breakpoint */
  isBreakpoint(index: number): boolean {
    return this._breakpoints.has(index)
  }

  /** All breakpoints */
  get breakpoints(): number[] {
    return Array.from(this._breakpoints).sort((a, b) => a - b)
  }

  /** Clear all breakpoints */
  clearBreakpoints(): void {
    this._breakpoints.clear()
  }

  /** Check if current bar should trigger a pause */
  shouldPause(barIndex: number): boolean {
    if (this._breakpoints.has(barIndex)) {
      this._onBreakpoint?.(barIndex)
      return true
    }
    return false
  }

  /** Move to next bar (step mode) */
  stepToNext(current: number): number {
    return current + 1
  }
}
