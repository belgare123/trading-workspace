/**
 * SliApiServer.ts — HTTP middleware for SLI telemetry
 *
 * Mountable on any Connect/Express-compatible HTTP server.
 * Provides:
 *   GET /api/v1/telemetry/sli — Full SLI snapshot (all Runtimes)
 *   GET /api/v1/telemetry/sli/:domain — SLI for a specific domain
 *
 * Usage (Vite middleware):
 *   configureServer(server) {
 *     server.middlewares.use(createSliMiddleware())
 *   }
 *
 * @since 6.3.0
 */

import { RuntimeTelemetry } from './RuntimeTelemetry'
import type { IncomingMessage, ServerResponse } from 'node:http'

type NextFn = (err?: Error) => void

/**
 * Creates a Connect-compatible middleware for telemetry endpoints.
 */
export function createSliMiddleware(): (req: IncomingMessage, res: ServerResponse, next: NextFn) => void {
  return (req, res, next) => {
    const url = req.url ?? ''

    // Full snapshot
    if (url === '/api/v1/telemetry/sli' && req.method === 'GET') {
      serveJson(res, () => RuntimeTelemetry.instance.snapshot())
      return
    }

    // Domain-specific
    const domainMatch = url.match(/^\/api\/v1\/telemetry\/sli\/(\w+)$/)
    if (domainMatch && req.method === 'GET') {
      const domain = domainMatch[1]!
      serveJson(res, () => {
        const snap = RuntimeTelemetry.instance.domainSnapshot(domain)
        if (!snap) {
          res.statusCode = 404
          return { error: `Domain '${domain}' not found`, domains: ['gateway', 'trade', 'wallet', 'risk', 'strategy'] }
        }
        return snap
      })
      return
    }

    next()
  }
}

function serveJson(res: ServerResponse, getData: () => unknown): void {
  try {
    const data = getData()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.statusCode = res.statusCode || 200
    res.end(JSON.stringify(data, null, 2))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
  }
}
