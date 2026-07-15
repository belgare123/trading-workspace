import type { MarketRuntime } from './types';

/** Mock MarketService — будет заменён на WebSocket Runtime API */
export class MarketService implements MarketRuntime {
  readonly id = 'market' as const;

  private _prices: Record<string, number> = {
    BTCUSDT: 66210, ETHUSDT: 3450, SOLUSDT: 143, BNBUSDT: 577.38,
    ADAUSDT: 0.45, DOTUSDT: 7.12, AVAXUSDT: 35.80, LINKUSDT: 14.20,
  };

  private _subscribers = new Map<string, Set<(price: number) => void>>();

  subscribe(symbol: string, cb: (price: number) => void): () => void {
    if (!this._subscribers.has(symbol)) this._subscribers.set(symbol, new Set());
    this._subscribers.get(symbol)!.add(cb);
    // Немедленный колбэк с текущей ценой
    cb(this._prices[symbol] ?? 0);
    return () => this._subscribers.get(symbol)?.delete(cb);
  }

  async symbols(): Promise<string[]> {
    return Object.keys(this._prices);
  }

  async price(symbol: string): Promise<number> {
    return this._prices[symbol] ?? 0;
  }

  async orderBook(_symbol: string): Promise<{ bids: [number, number][]; asks: [number, number][] }> {
    return {
      bids: [[66200, 12.5], [66150, 8.3], [66100, 15.1]],
      asks: [[66220, 10.2], [66250, 7.8], [66300, 14.5]],
    };
  }
}
