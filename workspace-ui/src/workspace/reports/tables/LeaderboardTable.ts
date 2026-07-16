// ── LeaderboardTable — Optimization leaderboard ──
//
// @since 3.5.5

import type { LeaderboardRow } from '../types'

export interface LeaderboardTableData {
  columns: { id: string; label: string; align?: 'left' | 'right' | 'center' }[]
  rows: Record<string, string | number | null>[]
}

export function buildLeaderboardTable(rows: LeaderboardRow[]): LeaderboardTableData {
  return {
    columns: [
      { id: 'rank', label: 'Rank', align: 'right' },
      { id: 'trialId', label: 'Trial ID', align: 'left' },
      { id: 'score', label: 'Score', align: 'right' },
      { id: 'tradeCount', label: 'Trades', align: 'right' },
      { id: 'profit', label: 'Profit $', align: 'right' },
    ],
    rows: rows.map(r => ({
      rank: r.rank,
      trialId: r.trialId.slice(0, 20),
      score: r.score !== null ? Math.round(r.score * 10000) / 10000 : null,
      tradeCount: r.tradeCount,
      profit: r.profit !== null ? Math.round(r.profit * 100) / 100 : null,
    })),
  }
}
