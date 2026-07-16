// ── OptimizationRuntime — Top-level orchestrator for optimization campaigns ──
//
// Manages multiple OptimizationSessions.
// Pure orchestration — no trading or optimization logic.
//
// @since 3.5.4

import type {
  OptimizationConfig, OptimizationSessionInfo, TrialResult,
  ParameterSpace, ObjectiveDefinition, OptimizationAlgorithm,
} from '../types'
import { OptimizationSession, type OptimizationSessionEvent } from './OptimizationSession'

export type OptimizationRuntimeEvent =
  | { type: 'session-started'; session: OptimizationSessionInfo }
  | { type: 'session-progress'; session: OptimizationSessionInfo }
  | { type: 'session-completed'; session: OptimizationSessionInfo; trials: TrialResult[] }
  | { type: 'session-failed'; sessionId: string; error: string }

export type OptimizationRuntimeHandler = (event: OptimizationRuntimeEvent) => void

export class OptimizationRuntime {
  private _sessions: Map<string, OptimizationSession> = new Map()
  private _onEvent?: OptimizationRuntimeHandler

  constructor(onEvent?: OptimizationRuntimeHandler) {
    this._onEvent = onEvent
  }

  /** Create and start a new optimization session */
  async start(
    config: OptimizationConfig,
    space: ParameterSpace,
    objective: ObjectiveDefinition,
    algorithm: OptimizationAlgorithm,
  ): Promise<OptimizationSessionInfo> {
    const session = new OptimizationSession(
      config,
      space,
      objective,
      algorithm,
      (event: OptimizationSessionEvent) => {
        switch (event.type) {
          case 'progress':
            this._onEvent?.({
              type: 'session-progress',
              session: session.info,
            })
            break
          case 'completed':
            this._onEvent?.({
              type: 'session-completed',
              session: event.session,
              trials: event.trials,
            })
            break
          case 'failed':
            this._onEvent?.({
              type: 'session-failed',
              sessionId: session.id,
              error: event.error,
            })
            break
        }
      },
    )

    this._sessions.set(session.id, session)
    this._onEvent?.({ type: 'session-started', session: session.info })

    // Run async (fire and forget — events handle completion)
    session.run().catch(err => {
      this._onEvent?.({
        type: 'session-failed',
        sessionId: session.id,
        error: err instanceof Error ? err.message : String(err),
      })
    })

    return session.info
  }

  /** Get session by id */
  getSession(id: string): OptimizationSession | undefined {
    return this._sessions.get(id)
  }

  /** Get all sessions */
  listSessions(): OptimizationSessionInfo[] {
    return Array.from(this._sessions.values()).map(s => s.info)
  }

  /** Get trials for a session */
  getTrials(sessionId: string): TrialResult[] {
    const session = this._sessions.get(sessionId)
    if (!session) return []
    return (session as any)._trials ?? []
  }

  /** Cancel a session */
  cancelSession(sessionId: string): boolean {
    const session = this._sessions.get(sessionId)
    if (!session) return false
    // Future: implement cancellation
    return true
  }

  /** Get best trial across all sessions */
  get globalBest(): TrialResult | null {
    let best: TrialResult | null = null
    let bestScore = -Infinity

    for (const session of this._sessions.values()) {
      const b = session.best
      if (b && b.score !== null && b.score > bestScore) {
        best = b
        bestScore = b.score
      }
    }

    return best
  }
}
