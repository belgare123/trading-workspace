/**
 * FeedAdapter.ts — Interface for exchange feed connectors
 *
 * Every exchange adapter implements this contract.
 * LiveFeedRuntime talks to adapters, never to exchanges directly.
 *
 * @since 4.2
 */

import type { MarketEvent } from '../types'

export type Listener = (event: MarketEvent) => void

export interface FeedAdapter {
  /** Unique adapter identifier (e.g. 'binance', 'bybit', 'mock') */
  readonly id: string

  /** Connect to the exchange */
  connect(): Promise<void>

  /** Disconnect from the exchange */
  disconnect(): Promise<void>

  /** Subscribe to market data for a symbol */
  subscribe(symbol: string): Promise<void>

  /** Unsubscribe from a symbol */
  unsubscribe(symbol: string): Promise<void>

  /** Register a market event listener */
  on(event: MarketEvent['type'], handler: Listener): void

  /** Remove a market event listener */
  off(event: MarketEvent['type'], handler: Listener): void
}
