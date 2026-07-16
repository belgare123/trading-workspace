// ── ActionRuntime — executes actions with history tracking ──
//
// Thin runtime responsible for:
//   1. Executing a single action by id
//   2. Executing multiple actions in order
//   3. Tracking execution history
//
// No business logic — ActionDefinition.execute() handles it.
//
// @since 3.4.5

import { ActionRegistry } from '../registry/ActionRegistry'
import type { ActionResult, ActionLogEntry } from '../types'
import type { ExecutionContext } from '../../context'

export class ActionRuntime {
  private readonly _log: ActionLogEntry[] = []
  private readonly _maxLogSize = 1000

  /**
   * Execute a single action by id.
   * Returns the ActionResult from the action definition.
   */
  async execute(
    actionId: string,
    ctx: ExecutionContext,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    const def = ActionRegistry.getInstance().get(actionId)
    if (!def) {
      const result: ActionResult = { success: false, message: `Action not registered: ${actionId}` }
      this._logEntry(actionId, params, result)
      return result
    }

    try {
      const result = await def.execute(ctx, params)
      this._logEntry(actionId, params, result)
      return result
    } catch (err) {
      const result: ActionResult = {
        success: false,
        message: `Action ${actionId} threw: ${err instanceof Error ? err.message : String(err)}`,
      }
      this._logEntry(actionId, params, result)
      return result
    }
  }

  /**
   * Execute multiple actions in sequence.
   * Returns results for all actions. Does NOT stop on failure.
   * Filters out null/undefined actionIds.
   */
  async executeAll(
    actions: Array<{ actionId: string; params: Record<string, unknown> }>,
    ctx: ExecutionContext,
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = []
    for (const { actionId, params } of actions) {
      const result = await this.execute(actionId, ctx, params)
      results.push(result)
    }
    return results
  }

  /** Get execution history */
  history(limit?: number): ActionLogEntry[] {
    const entries = [...this._log].reverse()
    return limit ? entries.slice(0, limit) : entries
  }

  /** Clear execution history */
  clearHistory(): void {
    this._log.length = 0
  }

  // ── Private ──

  private _logEntry(
    actionId: string,
    params: Record<string, unknown>,
    result: ActionResult,
  ): void {
    this._log.push({
      actionId,
      timestamp: Date.now(),
      params,
      result,
    })
    // Trim old entries
    if (this._log.length > this._maxLogSize) {
      this._log.splice(0, this._log.length - this._maxLogSize)
    }
  }
}
