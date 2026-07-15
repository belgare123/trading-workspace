export const replaySnippet = `// Simulate replay session
console.log('🎬 Starting replay...')

runtimeEventBus.emit('replay.start', {
  sessionId: 'demo-' + Date.now(),
  ticks: 100,
}, { source: 'Playground' })

for (let i = 0; i < 5; i++) {
  runtimeEventBus.emit('market.tick', {
    symbol: 'BTCUSDT',
    price: 68000 + i * 100 + Math.random() * 50,
    volume: 1.5,
    change: Math.random() * 2,
  }, { source: 'Replay', traceId: 'demo-' + i })
}

console.log('✅ 5 ticks emitted')`
