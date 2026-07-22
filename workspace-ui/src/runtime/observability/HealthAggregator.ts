/**
 * HealthAggregator — per-module health checks + memory snapshots.
 *
 * Each runtime module (Gateway, Risk, Wallet, Strategy, OrderManager,
 * TradeLifecycle, Feed, Chart, EventBus) registers a health check function.
 * The aggregator calls all checks periodically and produces a unified
 * WorkspaceHealth snapshot.
 *
 * Usage:
 *   const health = new HealthAggregator()
 *   health.register('gateway', async () => ({
 *     healthy: gateway.connected,
 *     latency: gateway.ping,
 *     memory: gateway.memoryMB,
 *   }))
 *   const snapshot = await health.snapshot()
 *
 * @since 6.1.0
 */

/* ── Types ── */

export interface HealthCheckResult {
  /** Is this module healthy? */
  healthy: boolean
  /** Optional latency in ms */
  latency_ms?: number
  /** Optional memory in MB */
  memory_mb?: number
  /** Module uptime in seconds */
  uptime_seconds?: number
  /** Last error, if any */
  lastError?: string
  /** EventBus queue depth */
  queueDepth?: number
  /** Arbitrary additional data */
  [key: string]: unknown
}

export type HealthCheckFn = () => HealthCheckResult | Promise<HealthCheckResult>

export interface RegisteredCheck {
  name: string
  check: HealthCheckFn
  lastResult: HealthCheckResult | null
  lastCheckAt: string | null
  errors: number
}

export interface WorkspaceHealthSnapshot {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime_seconds: number
  modules: Record<string, HealthCheckResult>
  memory: {
    rss_mb: number
    heap_mb: number
    heap_used_mb: number
    by_module: Record<string, number>
  }
  summary: {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
  }
}

/* ── Helpers ── */

function getProcessMemory(): { rss_mb: number; heap_mb: number; heap_used_mb: number } {
  try {
    const usage = process.memoryUsage?.()
    if (usage) {
      return {
        rss_mb: Math.round(usage.rss / 1024 / 1024 * 10) / 10,
        heap_mb: Math.round(usage.heapTotal / 1024 / 1024 * 10) / 10,
        heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024 * 10) / 10,
      }
    }
  } catch {
    // not in Node.js environment
  }
  return { rss_mb: 0, heap_mb: 0, heap_used_mb: 0 }
}

let _startTime = Date.now()

/* ── Aggregator ── */

export class HealthAggregator {
  private readonly _checks = new Map<string, RegisteredCheck>()

  /** Register a health check function */
  register(name: string, check: HealthCheckFn): void {
    this._checks.set(name, {
      name,
      check,
      lastResult: null,
      lastCheckAt: null,
      errors: 0,
    })
  }

  /** Unregister a health check */
  unregister(name: string): void {
    this._checks.delete(name)
  }

  /** Run all health checks and return snapshot */
  async snapshot(): Promise<WorkspaceHealthSnapshot> {
    const modules: Record<string, HealthCheckResult> = {}
    let healthy = 0
    let degraded = 0
    let unhealthy = 0

    const promMemory = getProcessMemory()
    const byModule: Record<string, number> = {}
    let totalModuleMemory = 0

    for (const [name, reg] of this._checks) {
      try {
        const result = await reg.check()
        modules[name] = {
          ...result,
          lastError: result.lastError ?? undefined,
        }
        if (result.healthy) {
          healthy++
        } else {
          unhealthy++
        }
        if (result.memory_mb !== undefined) {
          byModule[name] = result.memory_mb
          totalModuleMemory += result.memory_mb
        }
        reg.lastResult = result
        reg.lastCheckAt = new Date().toISOString()
      } catch (err) {
        modules[name] = {
          healthy: false,
          lastError: err instanceof Error ? err.message : String(err),
        }
        unhealthy++
        reg.errors++
      }
    }

    const status = unhealthy > 0 ? 'unhealthy' : degraded > 0 ? 'degraded' : 'healthy'

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - _startTime) / 1000),
      modules,
      memory: {
        ...promMemory,
        by_module: byModule,
      },
      summary: {
        total: this._checks.size,
        healthy,
        degraded,
        unhealthy,
      },
    }
  }

  /** Snapshot in compact JSON format (for health endpoint) */
  async toJSON(): Promise<WorkspaceHealthSnapshot> {
    return await this.snapshot()
  }

  /** Number of registered modules */
  get moduleCount(): number {
    return this._checks.size
  }

  /** Last result for a specific module */
  lastResult(name: string): HealthCheckResult | null {
    return this._checks.get(name)?.lastResult ?? null
  }

  /** Reset start time (for testing) */
  static resetUptime(): void {
    _startTime = Date.now()
  }
}
