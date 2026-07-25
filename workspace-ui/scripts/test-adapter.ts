/**
 * Direct test: simulate what BybitFeedAdapter does step by step
 */
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'

const adapter = new BybitFeedAdapter()

// Intercept the ws property to add our own logging
adapter.on('market:kline', (event: any) => {
  console.log('[test] kline received:', event.data?.symbol, event.data?.close)
})

async function main() {
  console.log('[test] connecting...')
  await adapter.connect()
  console.log('[test] connected')
  
  console.log('[test] subscribing to BTCUSDT...')
  await adapter.subscribe('BTCUSDT')
  console.log('[test] subscribed')

  // Wait 30 seconds
  await new Promise(r => setTimeout(r, 30000))
  
  console.log('[test] done, disconnecting')
  await adapter.disconnect?.()
  process.exit(0)
}

main().catch(e => {
  console.error('[test] ERROR:', e)
  process.exit(1)
})
