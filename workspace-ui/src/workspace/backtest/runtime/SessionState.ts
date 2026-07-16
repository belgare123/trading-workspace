// ── SessionState — State machine for BacktestSession ──
//
// Status transitions:
//   idle → initializing → running → completed
//                                → paused → running
//                                → failed
//
// @since 3.5.3

import type { SessionStatus } from '../types'

export class SessionState {
  private _status: SessionStatus = 'idle'
  private _error: string | undefined

  get status(): SessionStatus {
    return this._status
  }

  get error(): string | undefined {
    return this._error
  }

  get isRunning(): boolean {
    return this._status === 'running'
  }

  get isFinished(): boolean {
    return this._status === 'completed' || this._status === 'failed'
  }

  get canStart(): boolean {
    return this._status === 'idle' || this._status === 'completed' || this._status === 'failed'
  }

  canTransitionTo(target: SessionStatus): boolean {
    const transitions: Record<SessionStatus, SessionStatus[]> = {
      idle: ['initializing'],
      initializing: ['running', 'failed'],
      running: ['paused', 'completed', 'failed'],
      paused: ['running', 'completed', 'failed'],
      completed: [],
      failed: [],
    }
    return transitions[this._status]?.includes(target) ?? false
  }

  transitionTo(target: SessionStatus): void {
    if (!this.canTransitionTo(target)) {
      throw new Error(
        `Cannot transition from '${this._status}' to '${target}'`,
      )
    }
    this._status = target
  }

  fail(error?: string): void {
    this._status = 'failed'
    this._error = error
  }

  reset(): void {
    this._status = 'idle'
    this._error = undefined
  }

  /** Human-readable status label */
  get label(): string {
    const labels: Record<SessionStatus, string> = {
      idle: 'Ready',
      initializing: 'Initializing',
      running: 'Running',
      paused: 'Paused',
      completed: 'Completed',
      failed: 'Failed',
    }
    return labels[this._status]
  }
}
