import { globalSearchRegistry } from '../SearchRegistry'

const items = [
  { id: 'opp-btc-long', title: 'BTCUSDT Long', description: 'Bullish divergence on RSI, support at $67,800', icon: '🟢', exchange: 'Binance' },
  { id: 'opp-eth-short', title: 'ETHUSDT Short', description: 'Bearish engulfing pattern, resistance at $3,520', icon: '🔴', exchange: 'Binance' },
  { id: 'opp-sol-long', title: 'SOLUSDT Long', description: 'Breakout above descending trendline', icon: '🟢', exchange: 'Bybit' },
  { id: 'opp-arb-btc', title: 'BTC Arbitrage', description: 'Price gap: Binance $68,200 → Bybit $68,350', icon: '⚡', exchange: 'Cross' },
  { id: 'opp-ldo-long', title: 'LDOUSDT Long', description: 'Accumulation pattern, volume spike', icon: '🟢', exchange: 'Coinbase' },
]

export function registerOpportunitiesAdapter() {
  globalSearchRegistry.register({
    id: 'opportunities',
    name: 'Opportunities',
    icon: '🎯',
    priority: 1,
    search: (query) => {
      const q = query.toLowerCase()
      return items
        .filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            o.description.toLowerCase().includes(q) ||
            o.exchange.toLowerCase().includes(q),
        )
        .map((o) => ({
          id: o.id,
          domain: 'opportunities',
          title: o.title,
          description: `[${o.exchange}] ${o.description}`,
          icon: o.icon,
          url: `/inspector?symbol=${o.title.replace(/USDT$/, '')}`,
          payload: { exchange: o.exchange },
        }))
    },
  })
}
