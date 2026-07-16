// ── TradesTable — Trade list table data ──
//
// @since 3.5.5

import type { TradeRow } from '../types'

export interface TradesTableData {
  columns: { id: string; label: string; align?: 'left' | 'right' | 'center' }[]
  rows: Record<string, string | number>[]
}

export function buildTradesTable(trades: TradeRow[]): TradesTableData {
  return {
    columns: [
      { id: 'index', label: '#', align: 'right' },
      { id: 'timestamp', label: 'Date', align: 'left' },
      { id: 'symbol', label: 'Symbol', align: 'left' },
      { id: 'direction', label: 'Dir', align: 'center' },
      { id: 'entryPrice', label: 'Entry', align: 'right' },
      { id: 'exitPrice', label: 'Exit', align: 'right' },
      { id: 'quantity', label: 'Qty', align: 'right' },
      { id: 'pnl', label: 'P/L $', align: 'right' },
      { id: 'pnlPercent', label: 'P/L %', align: 'right' },
      { id: 'barsHeld', label: 'Bars', align: 'right' },
    ],
    rows: trades.map(t => ({
      ...t,
      timestamp: new Date(t.timestamp).toISOString().slice(0, 16).replace('T', ' '),
      pnl: Math.round(t.pnl * 100) / 100,
      pnlPercent: Math.round(t.pnlPercent * 100) / 100,
    })),
  }
}
