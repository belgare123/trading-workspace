
import type { SearchRuntime, SearchResult, SearchItem } from './types';

export class SearchService implements SearchRuntime {
  readonly id = 'search' as const;
  private _items: SearchItem[] = [];

  async query(q: string): Promise<SearchResult[]> {
    const lower = q.toLowerCase();
    return this._items
      .filter(item => item.title.toLowerCase().includes(lower) || item.keywords.some(k => k.includes(lower)))
      .map(item => ({
        id: item.id,
        title: item.title,
        type: 'plugin',
        action: item.action,
      }));
  }

  register(_type: string, items: SearchItem[]): void {
    this._items.push(...items);
  }
}
