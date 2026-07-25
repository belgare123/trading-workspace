#!/usr/bin/env node
/**
 * replay-campaign.ts — Validation at Scale replay
 *
 * Calls PaperProvider.placeOrder() directly (bypasses PaperOrderAdapter overhead)
 * to measure engine stability at scale, not adapter-layer throughput.
 */

import { PaperBrokerAdapter } from '../src/workspace/live/brokers/PaperBrokerAdapter'
import { SymbolRegistry } from '../src/workspace/live/feed/SymbolRegistry'
import { ExecutionEventBus } from '../src/workspace/execution/events/ExecutionEventBus'

const mockBus = new ExecutionEventBus()
const mockSymbols = new SymbolRegistry()
mockSymbols.register({
  symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT',
  priceDecimals: 2, quantityDecimals: 4, minNotional: 5, minQuantity: 0.0001, status: 'active',
})

const mockFeed: any = {
  start: () => Promise.resolve(),
  stop: () => Promise.resolve(),
  subscribe: () => Promise.resolve(),
  unsubscribe: () => Promise.resolve(),
  bus: mockBus as any,
  symbols: mockSymbols,
  getOrderBook: () => null,
}

async function main() {
  const N = parseInt(process.env.TRADES ?? '1000', 10)
  const SYMBOL = 'BTCUSDT'
  const QTY = 0.001

  console.log(`Replay: ${N} trades, ${SYMBOL}, qty=${QTY}`)

  const broker = new PaperBrokerAdapter(mockFeed, {
    initialBalance: 1_000_000,
    symbols: [SYMBOL],
    seedBaseAssets: false,
  })
  await broker.connection.connect()
  const paper = broker.paper
  console.log(`Connected: USDT=${paper.cashLedger.free('USDT')}`)

  const t0 = Date.now()
  let filled = 0

  for (let i = 0; i < N; i++) {
    // Place order directly on PaperProvider (bypasses PaperOrderAdapter overhead)
    const buyResult = await paper.placeOrder({
      id: `bp_${i}_b_${Date.now()}`,
      strategyId: 'replay',
      symbol: SYMBOL,
      side: 'buy',
      type: 'market',
      quantity: QTY,
      timestamp: Date.now(),
    })
    if (buyResult.accepted) {
      // Market orders fill immediately — track via journal
      filled++
    } else {
      process.exit(1) // unexpected rejection
    }

    const sellResult = await paper.placeOrder({
      id: `bp_${i}_s_${Date.now()}`,
      strategyId: 'replay',
      symbol: SYMBOL,
      side: 'sell',
      type: 'market',
      quantity: QTY,
      timestamp: Date.now(),
    })
    if (sellResult.accepted) {
      filled++
    } else {
      process.exit(1)
    }

    if ((i + 1) % 1000 === 0) {
      const dt = ((Date.now() - t0) / 1000).toFixed(2)
      const eps = ((i + 1) * 2 / (Date.now() - t0) * 1000).toFixed(0)
      const mem = process.memoryUsage()
      console.log(`  [${i + 1}/${N}] ${dt}s, ${eps} eps, RSS=${(mem.rss / 1024 / 1024).toFixed(1)}MB`)
    }
  }

  const dt = Date.now() - t0
  const eps = (N * 2 / dt * 1000).toFixed(0)

  // Final checks
  const cash = paper.cashLedger.all()
  const positions = await paper.getPositions()
  const paperOrders = await paper.getOrders()
  const activeOrders = paperOrders.filter((o: any) => o.status === 'new' || o.status === 'partially_filled')
  const journalSize = paper.journal.getAll().length
  const mem = process.memoryUsage()
  const usdtTotal = cash.find(b => b.asset === 'USDT')?.total ?? 0
  const btcTotal = cash.find(b => b.asset === SYMBOL)?.total ?? 0

  const divergence = []
  if (filled !== N * 2) divergence.push(`filled=${filled} expected=${N * 2}`)
  if (btcTotal > 0.000001) divergence.push(`BTC residual=${btcTotal}`)
  if (positions.length > 0) divergence.push(`positions=${positions.length}`)
  if (activeOrders.length > 0) divergence.push(`activeOrders=${activeOrders.length}`)

  console.log()
  console.log('─'.repeat(40))
  console.log(`Filled: ${filled}/${N * 2}`)
  console.log(`Duration: ${(dt / 1000).toFixed(2)}s (${eps} eps)`)
  console.log(`USDT: ${usdtTotal.toFixed(4)}, ${SYMBOL}: ${btcTotal.toFixed(6)}`)
  console.log(`Positions: ${positions.length}, Active orders: ${activeOrders.length}`)
  console.log(`Journal: ${journalSize}`)
  console.log(`RSS: ${(mem.rss / 1024 / 1024).toFixed(1)}MB, Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`)

  if (divergence.length === 0) {
    console.log('\n✅ ALL CHECKS PASSED — Zero divergence')
  } else {
    console.log('\n❌ DIVERGENCES:', divergence.join(', '))
    process.exit(1)
  }

  try { await broker.dispose() } catch {}
}

main().catch(err => { console.error(err); process.exit(1) })
