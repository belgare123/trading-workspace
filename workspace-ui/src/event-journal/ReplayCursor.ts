// src/event-journal/ReplayCursor.ts
// Phase 5.3 — Position tracking for resume capability

/**
 * Tracks replay position and allows save/restore for resume after interruption.
 * Only responsible for: current sequence, advance(), save(), restore().
 */
export class ReplayCursor {
  private _current: number
  private saved: number
  private checkpointed: number

  constructor(initialSequence: number = 0) {
    this._current = initialSequence
    this.saved = initialSequence
    this.checkpointed = initialSequence
  }

  /** The current replay position (last applied sequence) */
  get current(): number {
    return this._current
  }

  /** Advance the cursor by one position */
  advance(): void {
    this._current++
  }

  /** Jump to a specific sequence */
  jumpTo(sequence: number): void {
    if (sequence < this._current) {
      throw new Error(
        `Cannot jump back: current=${this._current}, target=${sequence}`,
      )
    }
    this._current = sequence
  }

  /** Save the current position as the latest checkpoint */
  save(): void {
    this.checkpointed = this._current
  }

  /** Restore to the last saved checkpoint position */
  restore(): void {
    this._current = this.checkpointed
  }

  /** Remember current position as the initial state (for determinism checks) */
  snapshot(): void {
    this.saved = this._current
  }

  /** Reset to the saved snapshot */
  reset(): void {
    this._current = this.saved
  }

  /** Number of sequences advanced since the last snapshot */
  get progress(): number {
    return this._current - this.saved
  }

  /** Number of sequences since the last checkpoint */
  get sinceCheckpoint(): number {
    return this._current - this.checkpointed
  }
}
