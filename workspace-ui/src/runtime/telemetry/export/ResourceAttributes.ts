/**
 * ResourceAttributes.ts — Common resource labels for all exported metrics
 *
 * These attributes are attached to every metric exported by any exporter.
 * They identify the service, environment, and deployment context.
 *
 * All attributes MUST be set before exporters start (e.g. at startup).
 * Once set, they are immutable — changes require restart.
 *
 * @since 6.4.0
 */

export interface ResourceAttributes {
  /** Service/application name (e.g. 'workspace-ui') */
  readonly serviceName: string
  /** Service instance ID */
  readonly serviceInstanceId: string
  /** Workspace unique identifier */
  readonly workspaceId: string
  /** Runtime version (semver) */
  readonly runtimeVersion: string
  /** Git commit SHA */
  readonly gitCommit: string
  /** Deployment environment (mainnet, testnet, paper, dev) */
  readonly environment: string
  /** Exchange identifier (bybit, binance, mock) */
  readonly exchange: string
  /** Trading symbol filter (or 'all') */
  readonly symbol: string
  /** Hostname */
  readonly host: string
}

const _defaults: ResourceAttributes = {
  serviceName: 'workspace-ui',
  serviceInstanceId: 'unknown',
  workspaceId: 'default',
  runtimeVersion: '0.0.0',
  gitCommit: 'unknown',
  environment: 'dev',
  exchange: 'mock',
  symbol: 'all',
  host: 'localhost',
}

let _current: Readonly<ResourceAttributes> = { ..._defaults }

/**
 * Initialize resource attributes at startup.
 * Should be called once before any exporter starts.
 */
export function initResourceAttributes(attrs: Partial<ResourceAttributes>): void {
  _current = { ..._current, ...attrs }
}

/** Get current resource attributes (read-only) */
export function getResourceAttributes(): Readonly<ResourceAttributes> {
  return _current
}

/** Convert to Prometheus-compatible label-value pairs */
export function toPrometheusLabels(): string {
  const a = _current
  return `service="${a.serviceName}",environment="${a.environment}",exchange="${a.exchange}",symbol="${a.symbol}"`
}

/** Convert to OpenTelemetry Resource-compatible key-value pairs */
export function toOtelAttributes(): Array<[string, string]> {
  const a = _current
  return [
    ['service.name', a.serviceName],
    ['service.instance.id', a.serviceInstanceId],
    ['service.version', a.runtimeVersion],
    ['workspace.id', a.workspaceId],
    ['git.commit', a.gitCommit],
    ['deployment.environment', a.environment],
    ['exchange', a.exchange],
    ['symbol', a.symbol],
    ['host.name', a.host],
  ]
}

/** Merge resource labels with metric-specific labels */
export function mergeLabels(metricLabels: Record<string, string>): Record<string, string> {
  return {
    service: _current.serviceName,
    environment: _current.environment,
    exchange: _current.exchange,
    symbol: _current.symbol,
    ...metricLabels,
  }
}

/** Reset to defaults (for testing) */
export function _resetResourceAttributes(): void {
  _current = { ..._defaults }
}
