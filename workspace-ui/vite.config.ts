import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import type { Connect } from 'vite'

// ── Campaign state paths ──

const STATE_DIR = path.join(os.tmpdir(), 'paper-campaign')
const HEALTH_FILE = path.join(STATE_DIR, 'health.json')
const STATE_FILE = path.join(STATE_DIR, 'state.json')
const SNAPSHOTS_FILE = path.join(STATE_DIR, 'metrics', 'snapshots.jsonl')
const CACHE_FILE = path.join(STATE_DIR, 'metrics', 'real-trades.json')

// ── Helpers ──

function json(res: Connect.ServerResponse, data: unknown): void {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.statusCode = 200
  res.end(JSON.stringify(data))
}

function tryRead(file: string): string | null {
  try { return fs.readFileSync(file, 'utf-8') } catch { return null }
}

// ── Real trade parser from Docker logs ──

interface RealTrade {
  id: number
  pair: string
  type: 'long' | 'short'
  amount: number
  openRate: number
  closeRate: number
  profitPct: number
  profit: number
  openDate: string
  closeDate: string
  closeReason: string
}

let realTradesCache: RealTrade[] | null = null
let lastDockerRead = 0
const DOCKER_CACHE_TTL = 15000 // 15s

const RE_BUY_SIGNAL = /^\[bridge\] 📈 BUY signal: (\w+) price=([\d.]+)/
const RE_BUY_FILLED = /^\[bridge\] ✅ BUY filled: ([\d.]+) @ ([\d.]+) order=paper-(\d+)-(\d+)/
const RE_CLOSE_SIGNAL = /^\[bridge\] 📉 CLOSE signal: (\w+)/
const RE_CLOSE_FILLED = /^\[bridge\] ✅ CLOSE filled: ([\d.]+) @ ([\d.]+) order=paper-(\d+)-(\d+)/
const RE_TIMESTAMP = /^\[strategy\] 🎯 Signal #\d+: \w+ price=[\d.]+ ts=(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/

function parseDockerTrades(): RealTrade[] {
  try {
    // Try cache first
    if (Date.now() - lastDockerRead < DOCKER_CACHE_TTL && realTradesCache) {
      return realTradesCache
    }

    const output = execSync('docker logs --tail 5000 paper-campaign 2>&1', {
      timeout: 5000,
      encoding: 'utf-8',
    })

    const lines = output.split('\n')

    // Phase 1: collect buy events
    const buys: Array<{
      tradeNum: number
      pair: string
      amount: number
      price: number
      ts: string
    }> = []
    const closes: Array<{
      tradeNum: number
      pair: string
      amount: number
      price: number
      ts: string
    }> = []

    let currentBuy: { tradeNum: number; pair: string; price: number; ts: string } | null = null
    let currentClose: { tradeNum: number; pair: string; price: number; ts: string } | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // BUY signal → we know the pair and price
      const buySig = line.match(RE_BUY_SIGNAL)
      if (buySig) {
        currentBuy = { tradeNum: 0, pair: buySig[1], price: parseFloat(buySig[2]), ts: '' }
        // Next line might have timestamp
        continue
      }

      // CLOSE signal
      const closeSig = line.match(RE_CLOSE_SIGNAL)
      if (closeSig) {
        currentClose = { tradeNum: 0, pair: closeSig[1], price: 0, ts: '' }
        continue
      }

      // BUY filled
      const buyFilled = line.match(RE_BUY_FILLED)
      if (buyFilled && currentBuy) {
        const amount = parseFloat(buyFilled[1])
        const price = parseFloat(buyFilled[2])
        const tradeNum = parseInt(buyFilled[3])
        // Look for timestamp in previous lines
        let ts = currentBuy.ts
        // Check the line before for strategy signal
        if (i > 0) {
          const prevTs = lines[i - 1].match(RE_TIMESTAMP)
          if (prevTs) ts = prevTs[1]
        }
        buys.push({ tradeNum, pair: currentBuy.pair, amount, price, ts })
        currentBuy = null
        continue
      }

      // CLOSE filled
      const closeFilled = line.match(RE_CLOSE_FILLED)
      if (closeFilled && currentClose) {
        const amount = parseFloat(closeFilled[1])
        const price = parseFloat(closeFilled[2])
        const tradeNum = parseInt(closeFilled[3])
        let ts = currentClose.ts
        if (i > 0) {
          const prevTs = lines[i - 1].match(RE_TIMESTAMP)
          if (prevTs) ts = prevTs[1]
        }
        closes.push({ tradeNum, pair: currentClose.pair, amount, price, ts })
        currentClose = null
        continue
      }
    }

    // Phase 2: match buys with closes by amount and order
    // The campaign alternates BUY → CLOSE → BUY → CLOSE → ...
    // Each buy has tradeNum N, each close has tradeNum N+1
    // But amounts match exactly between a buy and its close
    const trades: RealTrade[] = []

    // Match: for each buy, find the close with matching amount
    const usedCloses = new Set<number>()
    let tradeId = 1000

    for (const buy of buys) {
      // Find the close with matching amount that hasn't been used
      const close = closes.find(
        c => Math.abs(c.amount - buy.amount) < 0.0001 && !usedCloses.has(c.tradeNum)
      )
      if (!close) continue

      usedCloses.add(close.tradeNum)

      const isLong = true // SmaCross only does longs
      const profit = (close.price - buy.price) * buy.amount
      const profitPct = ((close.price - buy.price) / buy.price) * 100
      const closeReason = profit >= 0 ? 'take_profit' : 'stop_loss'

      trades.push({
        id: ++tradeId,
        pair: buy.pair.replace('USDT', '/USDT'),
        type: isLong ? 'long' : 'short',
        amount: +buy.amount.toFixed(4),
        openRate: +buy.price.toFixed(2),
        closeRate: +close.price.toFixed(2),
        profitPct: +(((close.price - buy.price) / buy.price) * 100).toFixed(4),
        profit: +profit.toFixed(2),
        openDate: buy.ts,
        closeDate: close.ts,
        closeReason,
      })
    }

    // Cache
    realTradesCache = trades.sort((a, b) => b.id - a.id)
    lastDockerRead = Date.now()
    return realTradesCache
  } catch (e) {
    // Fallback to snapshot deltas if Docker is unavailable
    if (realTradesCache) return realTradesCache
    return []
  }
}

// ── Middleware for campaign API ──

function campaignApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? ''

    // GET /api/campaign/health — read health.json
    if (url === '/api/campaign/health') {
      const data = tryRead(HEALTH_FILE)
      if (data) { json(res, JSON.parse(data)); return }
      json(res, {
        timestamp: new Date().toISOString(),
        campaignAlive: false,
        campaignMemoryMB: null,
        wsPingOk: null,
        overall: 'offline',
        message: 'No health data yet — campaign may not be running',
      })
      return
    }

    // GET /api/campaign/state — read state.json
    if (url === '/api/campaign/state') {
      const data = tryRead(STATE_FILE)
      if (data) { json(res, JSON.parse(data)); return }
      json(res, {
        stage: 'unknown', uptime: '0', reconnectCount: 0,
        exceptionsCount: 0, lastCertResult: 'N/A', lastCertTimestamp: '',
        incidents: [], memoryMB: null,
        healthcheckDurationMs: null, lastHealthcheckTime: '',
        lastMarketEventAgeMs: null,
      })
      return
    }

    // GET /api/campaign/snapshots?limit=200 — read snapshots.jsonl
    if (url.startsWith('/api/campaign/snapshots')) {
      const raw = tryRead(SNAPSHOTS_FILE)
      if (!raw) { json(res, []); return }

      const lines = raw.trim().split('\n')
      const parsed = lines.map((l, i) => {
        try { return { index: i, ...JSON.parse(l) } } catch { return null }
      }).filter(Boolean)

      const urlObj = new URL(url, 'http://localhost')
      const limit = parseInt(urlObj.searchParams.get('limit') || '200', 10)
      json(res, parsed.slice(-Math.max(1, limit)))
      return
    }

    // GET /api/campaign/real-trades — parsed from Docker logs
    if (url === '/api/campaign/real-trades') {
      const trades = parseDockerTrades()
      json(res, trades)
      return
    }

    // GET /api/campaign/trades?limit=20 — compute trades from snapshot deltas
    if (url.startsWith('/api/campaign/trades')) {
      const raw = tryRead(SNAPSHOTS_FILE)
      if (!raw) { json(res, []); return }

      const lines = raw.trim().split('\n')
      const parsed = lines.map(l => {
        try { return JSON.parse(l) } catch { return null }
      }).filter(Boolean)

      const trades: Array<{
        timestamp: string; side: string; pnl: number; fee: number; equity: number
      }> = []
      for (let i = 1; i < parsed.length; i++) {
        const prev = parsed[i - 1].trading
        const curr = parsed[i].trading
        const pnlDelta = curr.realisedPnl - prev.realisedPnl
        const feeDelta = curr.totalFees - prev.totalFees
        const tradesDelta = curr.tradesRecorded - prev.tradesRecorded
        if (tradesDelta > 0 && (pnlDelta !== 0 || feeDelta !== 0)) {
          trades.push({
            timestamp: new Date(parsed[i].timestamp).toISOString(),
            side: pnlDelta >= 0 ? 'SELL' : 'BUY',
            pnl: Math.round(pnlDelta * 100) / 100,
            fee: Math.round(feeDelta * 100) / 100,
            equity: Math.round(curr.equity * 100) / 100,
          })
        }
      }

      const urlObj = new URL(url, 'http://localhost')
      const limit = parseInt(urlObj.searchParams.get('limit') || '20', 10)
      json(res, trades.slice(-Math.max(1, limit)))
      return
    }

    next()
  }
}

// ── Vite config ──

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'campaign-api',
      configureServer(server) {
        try { fs.mkdirSync(STATE_DIR, { recursive: true }) } catch { /* best-effort */ }
        server.middlewares.use(campaignApiMiddleware())
        console.log(`[campaign-api] Serving campaign data from ${STATE_DIR}`)
      },
    },
  ],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9121',
        bypass: (req) => {
          if (req.url?.startsWith('/api/campaign/')) {
            return req.url
          }
          return undefined
        },
      },
      '/ws': {
        target: 'ws://127.0.0.1:9121',
        ws: true,
      },
    },
  },
})
