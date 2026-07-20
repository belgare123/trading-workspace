#!/usr/bin/env node
/**
 * bybit-campaign-report.ts — Daily report generator for 7-day campaign
 *
 * Reads campaign state from state.json and produces a structured daily report.
 *
 * Usage:
 *   npx tsx scripts/bybit-campaign-report.ts
 *
 * Environment:
 *   CAMPAIGN_STATE_DIR  — State directory (default: ./campaign-state/)
 *
 * Report fields:
 *   Day, Date, Status, Uptime, Trades, PnL, Exceptions, KillSwitch
 *
 * @since 4.9E
 */

import * as fs from 'fs'
import * as path from 'path'

interface TradeRecord {
  time: string
  type: 'buy' | 'sell' | 'tp' | 'sl'
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  pnl?: number
  pnlPct?: number
}

interface CampaignState {
  startedAt: string
  symbol: string
  positionSizeUsdt: number
  status: 'running' | 'stopped' | 'paused'
  uptime: number
  trades: TradeRecord[]
  exceptions: number
  lastCheck: string
  currentPosition: { direction: string; quantity: number; entryPrice: number } | null
  dailyPnl: Record<string, number>
  totalPnl: number
  killSwitchTriggered: boolean
}

const STATE_DIR = path.resolve(process.env.CAMPAIGN_STATE_DIR ?? './campaign-state')
const STATE_FILE = path.join(STATE_DIR, 'state.json')

function fmt(s: number): string {
  return s.toFixed(2)
}

function fmtDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

function main() {
  if (!fs.existsSync(STATE_FILE)) {
    console.log(`❌ State file not found: ${STATE_FILE}`)
    console.log('   Run bybit-campaign-manager.ts first.')
    process.exit(1)
  }

  const state: CampaignState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  const now = new Date()
  const start = new Date(state.startedAt)
  const elapsedDays = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1

  // ── Compute daily stats ──
  const today = now.toISOString().slice(0, 10)
  const todayTrades = state.trades.filter(t => t.time.startsWith(today))
  const todayBuySell = todayTrades.filter(t => t.type === 'buy' || t.type === 'sell')
  const todayClose = todayTrades.filter(t => t.type === 'tp' || t.type === 'sl')
  const todayPnl = state.dailyPnl[today] ?? 0

  // Compute win rate
  const wins = state.trades.filter(t => (t.type === 'tp' || t.type === 'sl') && (t.pnl ?? 0) > 0).length
  const losses = state.trades.filter(t => (t.type === 'tp' || t.type === 'sl') && (t.pnl ?? 0) < 0).length
  const totalClosed = wins + losses

  // ── Print report ──

  const statusIcon = state.status === 'running' ? '🟢' : '🔴'
  const ksIcon = state.killSwitchTriggered ? '🔴' : '🟢'

  console.log('')
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║   Bybit MainNet 7-Day Campaign — Daily Report   ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Date:      ${now.toISOString().slice(0, 10)}`)
  console.log(`Day:       ${elapsedDays} / 7`)
  console.log(`Symbol:    ${state.symbol}`)
  console.log(`Size:      ${state.positionSizeUsdt} USDT`)
  console.log(`Status:    ${statusIcon} ${state.status}`)
  console.log(`Uptime:    ${fmtDuration(state.uptime)}`)
  console.log('')
  console.log('── Trades ──')
  console.log(`  Total closed:  ${totalClosed}`)
  console.log(`  Wins:          ${wins} (${totalClosed > 0 ? ((wins / totalClosed) * 100).toFixed(0) : 0}%)`)
  console.log(`  Losses:        ${losses} (${totalClosed > 0 ? ((losses / totalClosed) * 100).toFixed(0) : 0}%)`)
  console.log(`  Today opened:  ${todayBuySell.length}`)
  console.log(`  Today closed:  ${todayClose.length}`)
  console.log('')
  console.log('── P&L ──')
  console.log(`  Today P&L:     ${todayPnl >= 0 ? '+' : ''}${fmt(todayPnl)} USDT`)
  console.log(`  Total P&L:     ${state.totalPnl >= 0 ? '+' : ''}${fmt(state.totalPnl)} USDT`)
  // Print daily breakdown
  const days = Object.keys(state.dailyPnl).sort()
  if (days.length > 0) {
    console.log('  Daily:')
    for (const d of days) {
      const pnl = state.dailyPnl[d]
      console.log(`    ${d}:  ${pnl >= 0 ? '+' : ''}${fmt(pnl)} USDT`)
    }
  }
  console.log('')
  console.log('── Health ──')
  console.log(`  Exceptions:    ${state.exceptions}`)
  console.log(`  Kill switch:   ${ksIcon} ${state.killSwitchTriggered ? 'Triggered' : 'Active / OK'}`)
  console.log(`  Position:      ${state.currentPosition ? `${state.currentPosition.direction} ${state.currentPosition.quantity} @ ${state.currentPosition.entryPrice}` : 'None'}`)
  console.log(`  Last check:    ${state.lastCheck}`)
  console.log('')
  console.log('── Recent Trades (last 5) ──')
  const recent = state.trades.slice(-5).reverse()
  for (const t of recent) {
    const pnlStr = t.pnl !== undefined ? ` | PnL: ${t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)} USDT (${t.pnlPct?.toFixed(1) ?? '?'}%)` : ''
    console.log(`  [${t.time.slice(11, 19)}] ${t.type === 'tp' ? '🟢 TP' : t.type === 'sl' ? '🔴 SL' : t.type === 'buy' ? '🟢 BUY' : '🔴 SELL'} ${t.side.toUpperCase()} ${t.quantity} ${t.symbol} @ ${t.price}${pnlStr}`)
  }
  console.log('')
  console.log('──────────────────────────────────────────')
  console.log('')
}

main()
