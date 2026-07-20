import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Connect } from 'vite'

// ── Campaign state paths ──

const HEALTH_FILE = path.join(os.tmpdir(), 'paper-campaign', 'health.json')
const STATE_FILE = path.join(os.tmpdir(), 'paper-campaign', 'state.json')

// ── Middleware for campaign API ──

function campaignApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? ''

    if (url === '/api/campaign/health') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      try {
        const data = fs.readFileSync(HEALTH_FILE, 'utf-8')
        res.statusCode = 200
        res.end(data)
      } catch {
        res.statusCode = 200
        res.end(JSON.stringify({
          timestamp: new Date().toISOString(),
          campaignAlive: false,
          campaignMemoryMB: null,
          wsPingOk: null,
          overall: 'offline',
          message: 'No health data yet — campaign may not be running',
        }))
      }
      return
    }

    if (url === '/api/campaign/state') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      try {
        const data = fs.readFileSync(STATE_FILE, 'utf-8')
        res.statusCode = 200
        res.end(data)
      } catch {
        res.statusCode = 200
        res.end(JSON.stringify({
          stage: 'unknown',
          uptime: '0',
          reconnectCount: 0,
          exceptionsCount: 0,
          lastCertResult: 'N/A',
          lastCertTimestamp: '',
          incidents: [],
        }))
      }
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
        const dir = path.join(os.tmpdir(), 'paper-campaign')
        try { fs.mkdirSync(dir, { recursive: true }) } catch { /* best-effort */ }
        server.middlewares.use(campaignApiMiddleware())
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
