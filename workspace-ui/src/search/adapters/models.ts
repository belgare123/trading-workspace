import { globalSearchRegistry } from '../SearchRegistry'

const items = [
  { id: 'mdl-price-pred', title: 'BTC Price Predictor', description: 'LSTM-based short-term price prediction model', icon: '🤖', cat: 'Prediction' },
  { id: 'mdl-sentiment', title: 'Sentiment Analyzer', description: 'News and social sentiment analysis model', icon: '💬', cat: 'NLP' },
  { id: 'mdl-volatility', title: 'Volatility Forecaster', description: 'GARCH-based volatility prediction', icon: '📊', cat: 'Risk' },
  { id: 'mdl-anomaly', title: 'Anomaly Detector', description: 'Isolation Forest anomaly detection', icon: '🔍', cat: 'Detection' },
  { id: 'mdl-cluster', title: 'Market Clustering', description: 'K-means market regime clustering', icon: '🔮', cat: 'Analysis' },
  { id: 'mdl-rl-agent', title: 'RL Trading Agent', description: 'Reinforcement learning trading agent (PPO)', icon: '🧠', cat: 'Reinforcement' },
]

export function registerModelsAdapter() {
  globalSearchRegistry.register({
    id: 'models',
    name: 'Models',
    icon: '🤖',
    priority: 5,
    search: (query) => {
      const q = query.toLowerCase()
      return items
        .filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.cat.toLowerCase().includes(q),
        )
        .map((m) => ({
          id: m.id,
          domain: 'models',
          title: m.title,
          description: m.description,
          icon: m.icon,
          url: `/models/${m.id}`,
          payload: { category: m.cat },
        }))
    },
  })
}
