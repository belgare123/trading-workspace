// ── Actions barrel ──
// Sprint 3.4.5 — Action Engine
//
// @since 3.4.5

export type { ActionResult, ActionParameter, ActionLogEntry } from './types'
export type { ActionDefinition } from './definition/ActionDefinition'

export { ActionRegistry } from './registry/ActionRegistry'
export { ActionRuntime } from './runtime/ActionRuntime'

// Builtins
export { registerAll as registerBuiltinActions } from './builtins/index'
export {
  BuyMarketAction,
  SellMarketAction,
  BuyLimitAction,
  SellLimitAction,
  ClosePositionAction,
  ReversePositionAction,
  ScaleInAction,
  ScaleOutAction,
  SetStopLossAction,
  SetTakeProfitAction,
  MoveStopToBreakevenAction,
  CancelOrderAction,
  CancelAllOrdersAction,
  ReplaceOrderAction,
} from './builtins/index'

// Utils
export {
  orderSuccess,
  actionError,
  requireParam,
  numberParam,
  stringParam,
} from './utils/ActionHelpers'
