// ── TradesSection — Trade analytics ──
//
// @since 3.5.5

import type { SectionView, TradeRow } from '../types'

export function buildTradesSection(
  records: {
    timestamp: number
    symbol: string
    direction: 'long' | 'short'
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    pnlPercent: number
    barsHeld: number
  }[],
): SectionView {
  const trades: TradeRow[] = records.map((r, i) => ({
    index: i + 1,
    ...r,
  }))

  // Profit distribution (histogram)
  const pnls = trades.map(t => t.pnl)
  const minPnl = Math.min(...pnls, 0)
  const maxPnl = Math.max(...pnls, 0)
  const binCount = Math.min(20, Math.max(5, Math.floor(pnls.length / 5)))
  const binWidth = (maxPnl - minPnl) / binCount || 1
  const bins = Array.from({ length: binCount }, (_, i) => ({
    rangeMin: minPnl + i * binWidth,
    rangeMax: minPnl + (i + 1) * binWidth,
    count: 0,
  }))
  for (const pnl of pnls) {
    const idx = Math.min(Math.floor((pnl - minPnl) / binWidth), binCount - 1)
    if (idx >= 0) bins[idx].count++
  }

  // Day of week profit
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayProfit = new Array(7).fill(0)
  for (const t of trades) {
    const d = new Date(t.timestamp).getDay()
    dayProfit[d] += t.pnl
  }

  // Hour of day profit
  const hourProfit = new Array(24).fill(0)
  for (const t of trades) {
    const h = new Date(t.timestamp).getHours()
    hourProfit[h] += t.pnl
  }
  const hourBars = Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, value: hourProfit[h] }))

  // Win/loss streak
  let longestWin = 0; let currentWin = 0
  let longestLoss = 0; let currentLoss = 0
  for (const t of trades) {
    if (t.pnl > 0) {
      currentWin++; currentLoss = 0
      longestWin = Math.max(longestWin, currentWin)
    } else {
      currentLoss++; currentWin = 0
      longestLoss = Math.max(longestLoss, currentLoss)
    }
  }

  return {
    type: 'trades',
    data: {
      profitDistribution: [{
        id: 'pnl-distribution',
        name: 'P/L Distribution',
        bins,
      }],
      dayOfWeekProfit: {
        id: 'day-of-week',
        name: 'Profit by Day of Week',
        bars: dayProfit.map((v, i) => ({ label: dayNames[i], value: v })),
      },
      hourOfDayProfit: {
        id: 'hour-of-day',
        name: 'Profit by Hour',
        bars: hourBars,
      },
      winLossStreak: { longestWin, longestLoss },
      tradeList: trades,
    },
  }
}
