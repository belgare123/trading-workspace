/**
 * TradingSessionRule.ts — Restricts trading to specific time windows
 *
 * Only allows order submissions within configured trading sessions.
 * Useful for limiting trading to market hours or avoiding after-hours execution.
 *
 * @since 4.7
 */

import { createRiskDefinition } from '../definition/RiskDefinition'
import { reject } from '../utils/RiskHelpers'
import type { RiskContext, RiskDecision } from '../types'

interface TradingSessionConfig {
  start: string   // HH:mm in 24h format, e.g. "09:30"
  end: string     // HH:mm in 24h format, e.g. "16:00"
  timezone: string // IANA timezone, e.g. "America/New_York"
}

interface TradingSessionParams {
  sessions: TradingSessionConfig[]
  allowOutside: boolean  // true = allow outside sessions with warning, false = reject
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number)
  return { hours: h ?? 0, minutes: m ?? 0 }
}

function isInSession(session: TradingSessionConfig, now: Date): boolean {
  const start = parseTime(session.start)
  const end = parseTime(session.end)

  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes = end.hours * 60 + end.minutes

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }
  // Overnight session (e.g. 17:00 - 09:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes
}

export const TradingSessionRule = createRiskDefinition({
  id: 'trading_session',
  name: 'Trading Session',
  description: 'Restricts trading to configured time windows',
  defaultConfig: {
    severity: 'error',
    params: {
      sessions: [
        { start: '00:00', end: '23:59', timezone: 'UTC' },
      ],
      allowOutside: false,
    } satisfies TradingSessionParams,
  },
  evaluate(context: RiskContext, config): RiskDecision {
    const params = config.params as unknown as TradingSessionParams
    const now = new Date(context.meta.now)

    // Check if current time falls in any configured session
    const inSession = params.sessions.some(session => isInSession(session, now))

    if (inSession) {
      return { status: 'allow', violations: [], warnings: [], score: 1.0 }
    }

    if (params.allowOutside) {
      return { status: 'allow', violations: [], warnings: [{
        ruleId: 'trading_session',
        ruleName: 'Trading Session',
        severity: 'warning',
        message: 'Trading outside configured session hours',
      }], score: 0.5 }
    }

    return reject('trading_session', 'Trading Session',
      `Current time ${now.toISOString()} is outside configured trading sessions`)
  },
})
