// ── Lifecycle Event Factory ──

import { Trade, type TradeId } from '../Trade'
import {
  TradeEventType,
  type AnyTradeEvent,
  type TradeLifecycleEvent,
} from '../TradeLifecycleEvent'

/** Create a typed lifecycle event from a Trade snapshot */
export function createTradeLifecycleEvent(
  trade: Trade,
  type: TradeEventType,
): AnyTradeEvent {
  const snapshot = trade.toSnapshot()

  const base = {
    tradeId: trade.id,
    trade: snapshot,
    timestamp: Date.now(),
  }

  switch (type) {
    case TradeEventType.TradeOpened:
      return { ...base, type } as AnyTradeEvent
    case TradeEventType.TradeEntryPending:
      return { ...base, type } as AnyTradeEvent
    case TradeEventType.TradeEntryFilled:
      return { ...base, type, entry: snapshot.entry } as AnyTradeEvent
    case TradeEventType.TradeEntryPartial:
      return { ...base, type, entry: snapshot.entry } as AnyTradeEvent
    case TradeEventType.TradeExitPending:
      return { ...base, type, exitReason: snapshot.metadata.lastExitReason ?? 'unknown' } as AnyTradeEvent
    case TradeEventType.TradeExitPartial:
      return { ...base, type } as AnyTradeEvent
    case TradeEventType.TradeClosed:
      return { ...base, type, exitReason: snapshot.metadata.lastExitReason ?? 'unknown' } as AnyTradeEvent
    case TradeEventType.TradeCancelled:
      return { ...base, type } as AnyTradeEvent
    case TradeEventType.TradeRejected:
      return { ...base, type, reason: (snapshot.metadata.rejectReason as string) ?? 'unknown' } as AnyTradeEvent
    case TradeEventType.TradeErrored:
      return { ...base, type, error: (snapshot.metadata.lastError as string) ?? 'unknown' } as AnyTradeEvent
    case TradeEventType.TradeModified:
      return { ...base, type } as AnyTradeEvent
    case TradeEventType.TradePnLUpdated:
      return { ...base, type, unrealizedPnL: snapshot.unrealizedPnL } as AnyTradeEvent
    default:
      return { ...base, type } as AnyTradeEvent
  }
}
