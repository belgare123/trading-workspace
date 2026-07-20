/**
 * SymbolRegistry.ts — Registry of active trading symbols
 *
 * Tracks which symbols are available, subscribed, and their metadata.
 * Single source of truth for symbol state across the platform.
 *
 * @since 4.2
 */

export interface SymbolInfo {
  symbol: string
  baseAsset: string
  quoteAsset: string
  priceDecimals: number
  quantityDecimals: number
  minNotional: number
  minQuantity: number
  maxQuantity?: number
  stepSize?: number
  tickSize?: number
  status: 'active' | 'inactive' | 'halted'
}

export class SymbolRegistry {
  private symbols = new Map<string, SymbolInfo>()

  /** Register or update a symbol */
  register(info: SymbolInfo): void {
    this.symbols.set(info.symbol, info)
  }

  /** Register multiple symbols */
  registerMany(infos: SymbolInfo[]): void {
    for (const info of infos) {
      this.register(info)
    }
  }

  /** Get symbol info */
  get(symbol: string): SymbolInfo | undefined {
    return this.symbols.get(symbol.toUpperCase())
  }

  /** Check if a symbol is registered */
  has(symbol: string): boolean {
    return this.symbols.has(symbol.toUpperCase())
  }

  /** List all registered symbols */
  getAll(): SymbolInfo[] {
    return Array.from(this.symbols.values())
  }

  /** List active symbols only */
  getActive(): SymbolInfo[] {
    return this.getAll().filter(s => s.status === 'active')
  }

  /** Remove a symbol */
  remove(symbol: string): void {
    this.symbols.delete(symbol.toUpperCase())
  }

  /** Clear all symbols */
  clear(): void {
    this.symbols.clear()
  }

  /** Get count of registered symbols */
  get size(): number {
    return this.symbols.size
  }
}
