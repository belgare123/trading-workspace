// ── Built-in actions barrel ──
// Registers all built-in actions with ActionRegistry.
//
// Call registerAll() once at application startup to make
// all built-in actions available.
//
// @since 3.4.5

import { ActionRegistry } from '../registry/ActionRegistry'

// Entry
import { BuyMarketAction } from './BuyMarketAction'
import { SellMarketAction } from './SellMarketAction'
import { BuyLimitAction } from './BuyLimitAction'
import { SellLimitAction } from './SellLimitAction'

// Position
import { ClosePositionAction } from './ClosePositionAction'
import { ReversePositionAction } from './ReversePositionAction'
import { ScaleInAction } from './ScaleInAction'
import { ScaleOutAction } from './ScaleOutAction'

// Risk
import { SetStopLossAction } from './SetStopLossAction'
import { SetTakeProfitAction } from './SetTakeProfitAction'
import { MoveStopToBreakevenAction } from './MoveStopToBreakevenAction'

// Orders
import { CancelOrderAction } from './CancelOrderAction'
import { CancelAllOrdersAction } from './CancelAllOrdersAction'
import { ReplaceOrderAction } from './ReplaceOrderAction'

/** Register all built-in actions */
export function registerAll(): void {
  const registry = ActionRegistry.getInstance()

  // Entry
  registry.register(BuyMarketAction)
  registry.register(SellMarketAction)
  registry.register(BuyLimitAction)
  registry.register(SellLimitAction)

  // Position
  registry.register(ClosePositionAction)
  registry.register(ReversePositionAction)
  registry.register(ScaleInAction)
  registry.register(ScaleOutAction)

  // Risk
  registry.register(SetStopLossAction)
  registry.register(SetTakeProfitAction)
  registry.register(MoveStopToBreakevenAction)

  // Orders
  registry.register(CancelOrderAction)
  registry.register(CancelAllOrdersAction)
  registry.register(ReplaceOrderAction)
}

export {
  // Entry
  BuyMarketAction,
  SellMarketAction,
  BuyLimitAction,
  SellLimitAction,
  // Position
  ClosePositionAction,
  ReversePositionAction,
  ScaleInAction,
  ScaleOutAction,
  // Risk
  SetStopLossAction,
  SetTakeProfitAction,
  MoveStopToBreakevenAction,
  // Orders
  CancelOrderAction,
  CancelAllOrdersAction,
  ReplaceOrderAction,
}
