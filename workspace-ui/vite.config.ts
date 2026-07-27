import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Connect } from 'vite'

// ── Campaign state paths ──

const STATE_DIR = path.join(os.tmpdir(), 'paper-campaign')
const HEALTH_FILE = path.join(STATE_DIR, 'health.json')
const STATE_FILE = path.join(STATE_DIR, 'state.json')
const SNAPSHOTS_FILE = path.join(STATE_DIR, 'metrics', 'snapshots.jsonl')

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

      // Parse limit from query string
      const urlObj = new URL(url, 'http://localhost')
      const limit = parseInt(urlObj.searchParams.get('limit') || '200', 10)
      const result = parsed.slice(-Math.max(1, limit))

      json(res, result)
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

      // Derive individual trades from changes in realisedPnl and totalFees
      const trades: Array<{
        timestamp: string; side: string; pnl: number; fee: number;
        equity: number
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
        // Ensure state directory exists
        try { fs.mkdirSync(STATE_DIR, { recursive: true }) } catch { /* best-effort */ }
        server.middlewares.use(campaignApiMiddleware())

        // Log API calls in dev
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
          // Don't proxy campaign API calls
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
