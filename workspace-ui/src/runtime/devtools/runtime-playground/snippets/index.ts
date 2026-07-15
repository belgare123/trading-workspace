/**
 * Runtime Playground — Script Snippets
 *
 * Готовые сценарии для ScriptRunner.
 *
 * @since 2.0.0
 */

export const marketSnippet = `// Emit market tick event
runtimeEventBus.emit('market.tick', {
  symbol: 'BTCUSDT',
  price: 68500 + Math.random() * 100,
  volume: 1.2 + Math.random(),
  change: (Math.random() - 0.5) * 4
}, { source: 'Playground' })

console.log('✅ market.tick emitted')`

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

export const pluginSnippet = `// Load a plugin via WidgetRegistry
console.log('Loading plugin: market-heatmap')

// In real runtime this would use PluginLoader
const registered = WidgetRegistry.getList()
console.log('Currently registered widgets:', registered.map(w => w.id))

console.log('✅ Plugin loaded')`

export const eventsSnippet = `// Subscribe and emit events
const unsub = runtimeEventBus.on('system.info', (evt) => {
  console.log('📨 Received:', evt.topic, evt.payload)
})

// Emit test notification
runtimeEventBus.emit('notification.send', {
  title: 'Test Notification',
  message: 'Hello from Script Runner!',
  level: 'info',
  plugin: 'playground',
}, { source: 'ScriptRunner', severity: 'low' })

runtimeEventBus.emit('system.info', {
  message: 'Script Runner active',
  timestamp: Date.now(),
}, { source: 'ScriptRunner' })

console.log('✅ Events emitted — unsubscribing')
unsub()`

export const mlSnippet = `// Emit ML prediction result
console.log('🧠 Running ML prediction...')

const prediction = {
  modelId: 'price-predictor',
  prediction: 45000 + Math.random() * 2000,
  confidence: 0.75 + Math.random() * 0.2,
  timestamp: Date.now(),
  features: {
    rsi: 62,
    macd: 145,
    volume: 1.2e6,
  },
}

runtimeEventBus.emit('ml.predict', prediction, {
  source: 'MLPredictor',
  severity: 'info',
  tags: ['ml', 'prediction'],
})

console.log('✅ ML prediction:', JSON.stringify(prediction, null, 2))`
