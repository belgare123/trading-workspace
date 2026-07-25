/**
 * CampaignContext.ts — Immutable campaign identity
 *
 * Every snapshot carries a CampaignContext so metrics are self-describing
 * and trivially joinable across sessions, exchanges, and strategies.
 *
 * @since 4.9
 */

export interface CampaignContext {
  /** Human-readable campaign ID, e.g. "paper-20260725" */
  readonly id: string
  /** Unix ms when the campaign was started */
  readonly startedAt: number
  /** Exchange name, e.g. "Bybit", "Binance" */
  readonly exchange: string
  /** Strategy name, e.g. "SmaCross" */
  readonly strategy: string
  /** Git commit hash the campaign binary was built from */
  readonly gitCommit: string
  /** Build version from package.json or CI pipeline */
  readonly buildVersion: string
  /** Campaign mode */
  readonly mode: 'paper' | 'live'
  /** Smoke mode (shortened burn-in, minimal data) */
  readonly smoke: boolean
}

/**
 * Build a CampaignContext from runtime values.
 * gitCommit and buildVersion are best-effort — if unavailable the
 * caller should pass "unknown".
 */
export function createCampaignContext(params: {
  id?: string
  exchange: string
  strategy: string
  mode: 'paper' | 'live'
  smoke?: boolean
  startedAt?: number
  gitCommit?: string
  buildVersion?: string
}): CampaignContext {
  const now = params.startedAt ?? Date.now()
  const date = new Date(now)
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = params.mode === 'live' ? 'live' : 'paper'

  return Object.freeze({
    id: params.id ?? `${prefix}-${dateStr}`,
    startedAt: now,
    exchange: params.exchange,
    strategy: params.strategy,
    gitCommit: params.gitCommit ?? 'unknown',
    buildVersion: params.buildVersion ?? 'unknown',
    mode: params.mode,
    smoke: params.smoke ?? false,
  })
}
