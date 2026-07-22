import { BybitExecutionGateway } from '../src/workspace/live/gateway/BybitExecutionGateway'
import { BybitBrokerAdapter } from '../src/workspace/live/brokers/BybitBrokerAdapter'
import { BybitFeedAdapter } from '../src/workspace/live/adapters/BybitFeedAdapter'
import { LiveFeedRuntime } from '../src/workspace/live/feed/LiveFeedRuntime'
import { ExecutionMode } from '../src/workspace/live/gateway/ExecutionMode'

async function main() {
  const feed = new LiveFeedRuntime()
  feed.useAdapter(new BybitFeedAdapter())
  await feed.subscribe('XRPUSDT')
  
  const broker = new BybitBrokerAdapter(feed, { symbols: ['XRPUSDT'], testnet: false })
  const gw = new BybitExecutionGateway(broker, {
    mode: ExecutionMode.Live,
    credentials: { apiKey: 'test-key', secret: 'test-secret' },
  } as any)
  
  console.log('testnet field:', gw['testnet'])
  console.log('_storedCredentials:', gw['_storedCredentials'])
}
main().catch(e => console.error('Error:', e.message))
