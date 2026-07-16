// ── ConditionHelpers — async utilities for condition evaluation ──
// Pure helper functions for the Condition Engine.
// No state, no side effects.
//
// @since 3.4.4

/**
 * Aggregate scores from multiple condition results.
 * Returns the average score, or 0 if no scored results.
 */
export function aggregateScore(results: { score?: number }[]): number {
  const scored = results.filter(r => r.score != null)
  if (scored.length === 0) return 0
  return scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length
}

/**
 * Collect matched signals from multiple condition results.
 */
export function collectMatchedSignals(results: { matchedSignals?: string[] }[]): string[] {
  const set = new Set<string>()
  for (const r of results) {
    for (const s of r.matchedSignals ?? []) {
      set.add(s)
    }
  }
  return [...set]
}

/**
 * Check if the current time is within a trading session window.
 */
export function isInTimeWindow(
  now: number,
  sessionStart: string,  // HH:mm format
  sessionEnd: string,    // HH:mm format
): boolean {
  const date = new Date(now)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const currentMinutes = hours * 60 + minutes

  const [startH, startM] = sessionStart.split(':').map(Number)
  const [endH, endM] = sessionEnd.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes <= endMinutes) {
    // Normal day session (e.g. 09:30 - 16:00)
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }
  // Overnight session (e.g. 22:00 - 06:00)
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes
}

/**
 * Collect reason strings from multiple child results.
 */
export function collectReasons(results: { reason?: string }[]): string[] {
  return results
    .map(r => r.reason)
    .filter((r): r is string => r != null)
}
