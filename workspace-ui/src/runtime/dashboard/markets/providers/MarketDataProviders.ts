/**
 * MarketDataProviders — mock implementations for all 9 market widgets.
 *
 * Each provider generates realistic random data via Runtime API services.
 * When REST/WebSocket arrives, only these provider bodies change —
 * widget UI code is untouched.
 *
 * @since 3.1.3
 */

import type { WidgetDataProvider } from '../../data/DataProviderRegistry'
import type { RuntimeApi } from '../../../types'
import type {
  WatchlistRow, MarketOrderBook, Trade, DepthPoint,
  HeatmapCell, NewsItem, Alert, ExchangeStatus,
} from '../types'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'ARB', 'OP', 'MATIC']

function rnd(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range
}

function randomPrice(sym: string): number {
  const prices: Record<string, number> = {
    BTC: 66200, ETH: 3500, SOL: 143, AVAX: 38, LINK: 14.5, ARB: 0.85, OP: 2.1, MATIC: 0.72,
  }
  return rnd(prices[sym] ?? 100, (prices[sym] ?? 100) * 0.04)
}

// ── 1. Market Watchlist ──
export const marketWatchlistProvider: WidgetDataProvider<WatchlistRow[]> = {
  id: 'market-watchlist',
  subscribe(_runtime: RuntimeApi, callback: (data: WatchlistRow[]) => void): () => void {
    function poll() {
      const rows: WatchlistRow[] = SYMBOLS.map((sym) => {
        const price = randomPrice(sym)
        const change24h = rnd(0, 6)
        const signal: WatchlistRow['signal'] = Math.random() > 0.7
          ? (Math.random() > 0.5 ? 'LONG' : 'SHORT')
          : null
        return {
          symbol: sym, price, change24h,
          volume: Math.random() * 500_000,
          high24h: price * (1 + Math.random() * 0.03),
          low24h: price * (1 - Math.random() * 0.03),
          signal,
        }
      })
      callback(rows)
    }
    const iv = setInterval(poll, 3000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 2. Order Book ──
export const orderBookProvider: WidgetDataProvider<MarketOrderBook> = {
  id: 'market-orderbook',
  subscribe(_runtime: RuntimeApi, callback: (data: MarketOrderBook) => void): () => void {
    function poll() {
      const basePrice = randomPrice('BTC')
      const levels = 12
      const bids: MarketOrderBook['bids'] = []
      const asks: MarketOrderBook['asks'] = []
      for (let i = 0; i < levels; i++) {
        const bidPrice = basePrice * (1 - (i + 1) * 0.001)
        const askPrice = basePrice * (1 + (i + 1) * 0.001)
        const bidSize = Math.random() * 10 + 0.1
        const askSize = Math.random() * 10 + 0.1
        bids.push({ price: bidPrice, size: bidSize, total: 0 })
        asks.push({ price: askPrice, size: askSize, total: 0 })
      }
      // Compute cumulative totals
      let bidTotal = 0, askTotal = 0
      for (let i = levels - 1; i >= 0; i--) { bidTotal += bids[i].size; bids[i].total = bidTotal }
      for (let i = 0; i < levels; i++) { askTotal += asks[i].size; asks[i].total = askTotal }
      callback({
        symbol: 'BTCUSDT', bids, asks,
        spread: asks[0].price - bids[bids.length - 1].price,
        timestamp: Date.now(),
      })
    }
    const iv = setInterval(poll, 2000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 3. Time & Sales ──
export const timeAndSalesProvider: WidgetDataProvider<Trade[]> = {
  id: 'market-trades',
  subscribe(_runtime: RuntimeApi, callback: (data: Trade[]) => void): () => void {
    function poll() {
      const trades: Trade[] = []
      const count = 5 + Math.floor(Math.random() * 10)
      for (let i = 0; i < count; i++) {
        trades.push({
          id: `${Date.now()}-${i}`,
          symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          price: randomPrice('BTC'),
          volume: Math.random() * 2 + 0.01,
          side: Math.random() > 0.5 ? 'buy' : 'sell',
          time: Date.now() - i * 100,
        })
      }
      callback(trades)
    }
    const iv = setInterval(poll, 2000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 4. Market Depth ──
export const marketDepthProvider: WidgetDataProvider<DepthPoint[]> = {
  id: 'market-depth',
  subscribe(_runtime: RuntimeApi, callback: (data: DepthPoint[]) => void): () => void {
    function poll() {
      const basePrice = randomPrice('ETH')
      const points: DepthPoint[] = []
      for (let i = 0; i < 20; i++) {
        points.push({
          price: basePrice * (1 + (i - 10) * 0.002),
          bidVolume: Math.random() * 5000,
          askVolume: Math.random() * 5000,
        })
      }
      callback(points)
    }
    const iv = setInterval(poll, 3000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 5. Heatmap ──
export const marketHeatmapProvider: WidgetDataProvider<HeatmapCell[]> = {
  id: 'market-heatmap',
  subscribe(_runtime: RuntimeApi, callback: (data: HeatmapCell[]) => void): () => void {
    function poll() {
      const cells = SYMBOLS.map((sym) => ({
        symbol: sym,
        price: randomPrice(sym),
        change24h: rnd(0, 8),
        volume: Math.random() * 1_000_000_000,
        marketCap: Math.random() * 500_000_000_000,
      }))
      callback(cells)
    }
    const iv = setInterval(poll, 4000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 6. Exchange Status ──
export const exchangeStatusProvider: WidgetDataProvider<ExchangeStatus> = {
  id: 'market-exchange-status',
  subscribe(_runtime: RuntimeApi, callback: (data: ExchangeStatus) => void): () => void {
    function poll() {
      callback({
        exchange: 'Binance',
        connected: true,
        latencyMs: Math.floor(Math.random() * 50 + 10),
        uptime: 99.97,
        lastReconnect: Math.random() > 0.9 ? Date.now() - 60000 * Math.floor(Math.random() * 60) : undefined,
        services: [
          { name: 'REST API', status: Math.random() > 0.1 ? 'online' : 'degraded' },
          { name: 'WebSocket', status: Math.random() > 0.15 ? 'online' : 'degraded' },
          { name: 'Auth', status: 'online' },
          { name: 'FIX Gateway', status: Math.random() > 0.05 ? 'online' : 'offline' },
        ],
      })
    }
    const iv = setInterval(poll, 5000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 7. News Feed ──
const NEWS_ITEMS: { title: string; source: string; sentiment: NewsItem['sentiment']; symbols: string[] }[] = [
  { title: 'BTC Breaks $66K as Institutional Inflows Surge', source: 'CoinDesk', sentiment: 'positive', symbols: ['BTC'] },
  { title: 'Ethereum Layer-2 TVL Hits New All-Time High', source: 'The Block', sentiment: 'positive', symbols: ['ETH', 'ARB', 'OP'] },
  { title: 'Solana Validator Count Reaches 4,000', source: 'Solana Daily', sentiment: 'positive', symbols: ['SOL'] },
  { title: 'Regulatory Clarity Brings Mixed Reactions', source: 'Bloomberg', sentiment: 'neutral', symbols: ['BTC', 'ETH'] },
  { title: 'Avalanche Announces Major Network Upgrade', source: 'AVAX News', sentiment: 'positive', symbols: ['AVAX'] },
  { title: 'LINK Oracle Integration Expands to 50 New Protocols', source: 'Chainlink Today', sentiment: 'positive', symbols: ['LINK'] },
  { title: 'Market Correction Expected — Analysts Warn', source: 'Reuters', sentiment: 'negative', symbols: ['BTC', 'ETH', 'SOL'] },
  { title: 'DeFi Lending Volumes Drop 15% This Quarter', source: 'DeFi Pulse', sentiment: 'negative', symbols: ['ETH', 'MATIC'] },
  { title: 'Arbitrum DAO Passes Key Governance Proposal', source: 'Arbitrum News', sentiment: 'positive', symbols: ['ARB'] },
  { title: 'OP Mainnet Transaction Throughput Up 200%', source: 'Optimism Blog', sentiment: 'positive', symbols: ['OP'] },
]

export const newsFeedProvider: WidgetDataProvider<NewsItem[]> = {
  id: 'market-news',
  subscribe(_runtime: RuntimeApi, callback: (data: NewsItem[]) => void): () => void {
    function poll() {
      const items: NewsItem[] = NEWS_ITEMS.map((n, i) => ({
        id: `news-${i}`,
        title: n.title,
        source: n.source,
        url: '#',
        publishedAt: Date.now() - Math.floor(Math.random() * 3600000),
        sentiment: n.sentiment,
        symbols: n.symbols,
      }))
      callback(items)
    }
    const iv = setInterval(poll, 15000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 8. Active Alerts ──
// Reuses the Alert type from ../types
export { type Alert as ActiveAlert } from '../types'

export const activeAlertsProvider: WidgetDataProvider<Alert[]> = {
  id: 'market-alerts',
  subscribe(_runtime: RuntimeApi, callback: (data: Alert[]) => void): () => void {
    function poll() {
      const alerts: Alert[] = [
        { id: 'a-1', symbol: 'BTC', type: 'price', message: 'BTC above $66K — take profit target reached', severity: 'info', timestamp: Date.now() - 30000, acknowledged: false },
        { id: 'a-2', symbol: 'SOL', type: 'signal', message: 'SOL LONG signal activated (confidence 82%)', severity: 'warning', timestamp: Date.now() - 120000, acknowledged: false },
        { id: 'a-3', symbol: 'ETH', type: 'volume', message: 'Unusual volume spike on ETH/USDT (+340%)', severity: 'warning', timestamp: Date.now() - 300000, acknowledged: false },
        { id: 'a-4', symbol: 'SYSTEM', type: 'system', message: 'WebSocket reconnected after 3s outage', severity: 'info', timestamp: Date.now() - 600000, acknowledged: true },
        { id: 'a-5', symbol: 'AVAX', type: 'price', message: 'AVAX dropped 5% in 1 hour', severity: 'critical', timestamp: Date.now() - 900000, acknowledged: false },
      ]
      callback(alerts)
    }
    const iv = setInterval(poll, 10000)
    poll()
    return () => clearInterval(iv)
  },
}

// ── 9. Trading Chart (placeholder — uses existing MarketTick) ──
// We reuse the existing MarketTick from runtime/api types
export { } // ensure module

/**
 * TradingChart DataProvider — provides the latest candle/tick series.
 * For now returns an empty array (chart renders fallback).
 * Will be wired to real MarketApi.candles() in REST/WS iteration.
 */
export const tradingChartProvider: WidgetDataProvider<number[]> = {
  id: 'market-chart',
  subscribe(_runtime: RuntimeApi, callback: (data: number[]) => void): () => void {
    // Start with a synthetic price series
    let price = randomPrice('BTC')
    function poll() {
      price = price * (1 + (Math.random() - 0.5) * 0.001)
      const series: number[] = [price]
      callback(series)
    }
    const iv = setInterval(poll, 2000)
    poll()
    return () => clearInterval(iv)
  },
}
