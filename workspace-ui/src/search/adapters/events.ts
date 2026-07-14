import { globalSearchRegistry } from '../SearchRegistry'

const items = [
  { id: 'evt-btc-surge', title: 'BTC +5.2%', description: 'BTC surged above resistance at $68,200', icon: '⬆️', cat: 'Price' },
  { id: 'evt-eth-dump', title: 'ETH -3.1%', description: 'ETH dropped below support at $3,400', icon: '⬇️', cat: 'Price' },
  { id: 'evt-strat-activated', title: 'Strategy: MA Cross Activated', description: 'MA Cross strategy started on BTCUSDT', icon: '▶️', cat: 'Strategy' },
  { id: 'evt-plugin-installed', title: 'Plugin Installed: Signal View', description: 'Signal View v2.1.0 installed successfully', icon: '📦', cat: 'System' },
  { id: 'evt-replay-complete', title: 'Replay Complete', description: 'BTC demo replay finished (2h 15m simulated)', icon: '✅', cat: 'Replay' },
  { id: 'evt-risk-alert', title: 'Risk Alert: Drawdown 8%', description: 'Portfolio drawdown exceeded threshold', icon: '⚠️', cat: 'Risk' },
]

export function registerEventsAdapter() {
  globalSearchRegistry.register({
    id: 'events',
    name: 'Events',
    icon: '📋',
    priority: 4,
    search: (query) => {
      const q = query.toLowerCase()
      return items
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.cat.toLowerCase().includes(q),
        )
        .map((e) => ({
          id: e.id,
          domain: 'events',
          title: e.title,
          description: e.description,
          icon: e.icon,
          url: `/events/${e.id}`,
          payload: { category: e.cat },
        }))
    },
  })
}
