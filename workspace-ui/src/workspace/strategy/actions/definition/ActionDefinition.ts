// ── ActionDefinition — action contract ──
//
// An action is a pure unit of trade logic that receives
// ExecutionContext and parameters, and produces ActionResult.
//
// Actions know NOTHING about the exchange, broker, or trading core.
// They only call methods on ExecutionContext (ctx.orders.*).
//
// Three groups of actions:
//   Entry  — BuyMarket, SellMarket, BuyLimit, SellLimit
//   Position — Close, Reverse, ScaleIn, ScaleOut
//   Risk  — SetStopLoss, SetTakeProfit, MoveStopToBreakeven, TrailingStop
//   Orders  — CancelOrder, CancelAllOrders, ReplaceOrder
//
// @since 3.4.5

import type { ExecutionContext } from '../../context'
import type { ActionResult, ActionParameter } from '../types'

export interface ActionDefinition {
  /** Unique action id (e.g. 'buy-market', 'set-stop-loss') */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Semantic version */
  readonly version: string

  /** Brief description */
  readonly description?: string

  /** Parameter schema */
  readonly parameters?: ActionParameter[]

  /**
   * Execute the action.
   * Pure function — no side effects outside ExecutionContext.
   * Returns ActionResult with order/position IDs on success.
   */
  execute(
    ctx: ExecutionContext,
    params: Record<string, unknown>,
  ): Promise<ActionResult>
}
