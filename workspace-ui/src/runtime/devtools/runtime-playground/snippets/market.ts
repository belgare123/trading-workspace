export const marketSnippet = `// Emit market tick event
runtimeEventBus.emit('market.tick', {
  symbol: 'BTCUSDT',
  price: 68500 + Math.random() * 100,
  volume: 1.2 + Math.random(),
  change: (Math.random() - 0.5) * 4
}, { source: 'Playground' })

console.log('✅ market.tick emitted')`
