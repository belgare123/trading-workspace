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
