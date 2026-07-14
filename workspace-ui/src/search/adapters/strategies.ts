import { globalSearchRegistry } from '../SearchRegistry'

/** Return mock strategies for search.
 *  In production, this would query the backend or a local cache.
 */
function mockStrategies() {
  return [
    { id: 'strat-ma-cross', title: 'MA Cross', description: 'Moving Average Crossover strategy', icon: '📈' },
    { id: 'strat-rsi-mean', title: 'RSI Mean Reversion', description: 'RSI-based mean reversion strategy', icon: '📉' },
    { id: 'strat-grid', title: 'Grid Trading', description: 'Grid-based automated trading', icon: '🔲' },
    { id: 'strat-momentum', title: 'Momentum Breakout', description: 'Momentum breakout detection', icon: '🚀' },
    { id: 'strat-arb', title: 'Arbitrage Scanner', description: 'Cross-exchange arbitrage detection', icon: '⚡' },
  ]
}

const items = mockStrategies()

export function registerStrategiesAdapter() {
  globalSearchRegistry.register({
    id: 'strategies',
    name: 'Strategies',
    icon: '🧠',
    priority: 3,
    search: (query) => {
      const q = query.toLowerCase()
      return items
        .filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q),
        )
        .map((s) => ({
          id: s.id,
          domain: 'strategies',
          title: s.title,
          description: s.description,
          icon: s.icon,
          url: `/strategies/${s.id}`,
        }))
    },
  })
}
