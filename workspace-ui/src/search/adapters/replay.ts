import { globalSearchRegistry } from '../SearchRegistry'

const items = [
  { id: 'rp-btc-demo', title: 'BTC Demo (2025-12-01)', description: 'Full day replay: BTCUSDT, 15m candles', icon: '▶️', duration: '24h' },
  { id: 'rp-eth-crash', title: 'ETH Crash (2026-03-15)', description: 'ETH flash crash replay: -12% in 30min', icon: '📉', duration: '2h' },
  { id: 'rp-sol-pump', title: 'SOL Pump (2026-06-01)', description: 'SOL +18% rally replay', icon: '📈', duration: '4h' },
  { id: 'rp-ma-cross-test', title: 'MA Cross Backtest', description: 'MA Cross strategy on BTCUSDT, 90 days', icon: '🧪', duration: '90d' },
  { id: 'rp-grid-test', title: 'Grid Strategy Test', description: 'Grid strategy on ETHUSDT, 30 days', icon: '🔲', duration: '30d' },
]

export function registerReplayAdapter() {
  globalSearchRegistry.register({
    id: 'replay',
    name: 'Replay',
    icon: '▶️',
    priority: 4,
    search: (query) => {
      const q = query.toLowerCase()
      return items
        .filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q),
        )
        .map((r) => ({
          id: r.id,
          domain: 'replay',
          title: r.title,
          description: `${r.description} (${r.duration})`,
          icon: r.icon,
          url: `/replay/${r.id}`,
          payload: { duration: r.duration },
        }))
    },
  })
}
