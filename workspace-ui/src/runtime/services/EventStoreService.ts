import type { EventStoreRuntime, EventEntry, EventFilter } from './types';

export class EventStoreService implements EventStoreRuntime {
  readonly id = 'eventStore' as const;

  private _events: EventEntry[] = [
    { id: 'evt-1', type: 'signal:new', source: 'strategy', timestamp: Date.now() - 30000, data: { pair: 'BTCUSDT', dir: 'long' } },
    { id: 'evt-2', type: 'order:filled', source: 'execution', timestamp: Date.now() - 25000, data: { pair: 'ETHUSDT', qty: 5.0 } },
    { id: 'evt-3', type: 'system:health', source: 'runtime', timestamp: Date.now() - 10000, data: { services: 100 } },
  ];

  async query(filter: EventFilter): Promise<EventEntry[]> {
    let result = [...this._events];
    if (filter.types) result = result.filter(e => filter.types!.includes(e.type));
    if (filter.sources) result = result.filter(e => filter.sources!.includes(e.source));
    if (filter.limit) result = result.slice(0, filter.limit);
    return result;
  }

  subscribe(_filter: EventFilter, _cb: (event: EventEntry) => void): () => void {
    const interval = setInterval(() => {
      // Симуляция новых событий
    }, 5000);
    return () => clearInterval(interval);
  }
}
