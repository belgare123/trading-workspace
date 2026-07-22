// src/event-journal/EventApplier.ts
// Phase 5.4 — Generic event-to-aggregate applier.
// ReplayEngine does NOT know business logic — it delegates to EventApplier.
// Implementations map event types to aggregate handlers:
//   TradeCreated  → TradeAggregate.apply()
//   PositionOpened → WalletAggregate.apply()
//   OrderFilled   → OrderAggregate.apply()

/**
 * Universal interface for applying events to aggregate state.
 *
 * During replay, each event is routed to the appropriate aggregate handler
 * through this interface. The implementation determines:
 *   - Which event types go to which aggregates
 *   - How each event transforms the aggregate state
 *   - What validation/invariants to check
 *
 * @typeParam TState - The aggregate's state type (default: unknown)
 * @typeParam TEvent - The event type (default: unknown)
 */
export interface EventApplier<TState = unknown, TEvent = unknown> {
  /**
   * Apply a batch of events to an aggregate's state.
   * Events arrive in global sequence order (monotonic).
   *
   * @param aggregateId - The aggregate being replayed
   * @param state - Current aggregate state (mutated in place or cloned)
   * @param events - Events to apply, in global sequence order
   * @returns The updated state
   */
  apply<T = TState>(aggregateId: string, state: T, events: TEvent[]): T
}
