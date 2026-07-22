import { BybitExecutionGateway } from '../src/workspace/live/gateway/BybitExecutionGateway'
import { ExecutionMode } from '../src/workspace/live/gateway/ExecutionMode'

async function main() {
  const apiKey = process.env.BYBIT_API_KEY
  const apiSecret = process.env.BYBIT_API_SECRET
  
  console.log('TEST: process.env.BYBIT_API_KEY =', apiKey ? apiKey.slice(0,8)+'...' : '(empty/undefined)')
  console.log('TEST: process.env.BYBIT_API_SECRET =', apiSecret ? apiSecret.slice(0,8)+'...' : '(empty/undefined)')
  
  // Create a mock broker-like object (just to test constructor)
  const mockBroker = {
    connection: {
      connect: async (key: string, secret: string, testnet: boolean) => {
        console.log('connect called with key=', key ? key.slice(0,8)+'...' : '(empty)', ', testnet=', testnet)
        if (!key || !secret) throw new Error('Zero-length key')
      }
    }
  } as any
  
  const gw = new BybitExecutionGateway(mockBroker, {
    mode: ExecutionMode.Live,
    credentials: { apiKey, secret: apiSecret },
  } as any)
  
  console.log('gw testnet:', gw['testnet'])
  console.log('gw _storedCredentials:', gw['_storedCredentials'] ? 'YES' : 'NULL')
  
  // Now simulate GatewayRuntime.use()
  try {
    await (gw as any).connect({ mode: ExecutionMode.Live })
    console.log('Connect succeeded!')
  } catch (e: any) {
    console.log('Connect failed:', e.message)
  }
}

main().catch(e => console.error(e))
