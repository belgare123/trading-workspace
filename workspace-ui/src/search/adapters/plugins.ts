import { globalSearchRegistry } from '../SearchRegistry'

const items = [
  { id: 'plg-signal-view', title: 'Signal View', description: 'Visual signal overlay plugin', icon: '📊' },
  { id: 'plg-telegram', title: 'Telegram Bot', description: 'Telegram notifications and commands', icon: '✈️' },
  { id: 'plg-webhook', title: 'Webhook Alerter', description: 'Custom webhook alerts', icon: '🔔' },
  { id: 'plg-discord', title: 'Discord Notifier', description: 'Discord channel notifications', icon: '💬' },
  { id: 'plg-risk-manager', title: 'Risk Manager', description: 'Portfolio risk management plugin', icon: '🛡️' },
  { id: 'plg-backtest', title: 'Backtest Engine', description: 'Historical backtesting plugin', icon: '⏪' },
  { id: 'plg-paper-trade', title: 'Paper Trading', description: 'Simulated trading environment', icon: '📝' },
]

export function registerPluginsAdapter() {
  globalSearchRegistry.register({
    id: 'plugins',
    name: 'Plugins',
    icon: '🧩',
    priority: 2,
    search: (query) => {
      const q = query.toLowerCase()
      return items
        .filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q),
        )
        .map((p) => ({
          id: p.id,
          domain: 'plugins',
          title: p.title,
          description: p.description,
          icon: p.icon,
          url: `/plugins/${p.id}`,
        }))
    },
  })
}
