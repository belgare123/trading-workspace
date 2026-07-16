/**
 * CsvExporter.ts — Export history data as CSV/TSV
 *
 * @since 4.4
 */

import type { OrderHistoryEntry, PositionHistoryEntry, DecisionRecord, SessionRecord, TimelineEntry } from '../types'

type Row = Record<string, string | number | undefined>

export class CsvExporter {
  private delimiter: string

  constructor(delimiter = ',') {
    this.delimiter = delimiter
  }

  /** Export orders to CSV string */
  ordersToCsv(orders: OrderHistoryEntry[]): string {
    const headers = ['orderId', 'strategyId', 'symbol', 'side', 'type', 'quantity', 'price', 'status', 'filledQuantity', 'averagePrice', 'commission', 'createdAt', 'filledAt']
    const rows = orders.map(o => ({
      orderId: o.orderId,
      strategyId: o.strategyId,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      quantity: o.quantity,
      price: o.price,
      status: o.status,
      filledQuantity: o.filledQuantity,
      averagePrice: o.averagePrice,
      commission: o.commission,
      createdAt: o.createdAt,
      filledAt: o.filledAt,
    }))
    return this.toCsv(headers, rows)
  }

  /** Export positions to CSV string */
  positionsToCsv(positions: PositionHistoryEntry[]): string {
    const headers = ['positionId', 'strategyId', 'symbol', 'direction', 'openedAt', 'openPrice', 'initialQuantity', 'closedAt', 'closePrice', 'realizedPnl', 'pnlPercent', 'duration']
    const rows = positions.map(p => ({
      positionId: p.positionId,
      strategyId: p.strategyId,
      symbol: p.symbol,
      direction: p.direction,
      openedAt: p.openedAt,
      openPrice: p.openPrice,
      initialQuantity: p.initialQuantity,
      closedAt: p.closedAt,
      closePrice: p.closePrice,
      realizedPnl: p.realizedPnl,
      pnlPercent: p.pnlPercent,
      duration: p.duration,
    }))
    return this.toCsv(headers, rows)
  }

  /** Export decisions to CSV string */
  decisionsToCsv(decisions: DecisionRecord[]): string {
    const headers = ['id', 'strategyId', 'timestamp', 'symbol', 'signal', 'action', 'confidence', 'aggregateScore', 'orderId', 'result']
    const rows = decisions.map(d => ({
      id: d.id,
      strategyId: d.strategyId,
      timestamp: d.timestamp,
      symbol: d.symbol ?? '',
      signal: d.signal?.name ?? '',
      action: d.action.name,
      confidence: d.action.confidence,
      aggregateScore: d.aggregateScore,
      orderId: d.orderId ?? '',
      result: d.result ?? '',
    }))
    return this.toCsv(headers, rows)
  }

  /** Export sessions to CSV string */
  sessionsToCsv(sessions: SessionRecord[]): string {
    const headers = ['sessionId', 'strategyId', 'startedAt', 'endedAt', 'ordersPlaced', 'ordersFilled', 'netPnl', 'winRate', 'positionsOpened', 'positionsClosed', 'maxDrawdown']
    const rows = sessions.map(s => ({
      sessionId: s.sessionId,
      strategyId: s.strategyId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      ordersPlaced: s.ordersPlaced,
      ordersFilled: s.ordersFilled,
      netPnl: s.netPnl,
      winRate: s.winRate,
      positionsOpened: s.positionsOpened,
      positionsClosed: s.positionsClosed,
      maxDrawdown: s.maxDrawdown,
    }))
    return this.toCsv(headers, rows)
  }

  /** Export timeline to CSV string */
  timelineToCsv(entries: TimelineEntry[]): string {
    const headers = ['id', 'timestamp', 'category', 'label', 'detail', 'refId', 'symbol', 'strategyId']
    const rows = entries.map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      category: e.category,
      label: e.label,
      detail: e.detail,
      refId: e.refId ?? '',
      symbol: e.symbol ?? '',
      strategyId: e.strategyId ?? '',
    }))
    return this.toCsv(headers, rows)
  }

  private toCsv(headers: string[], rows: Row[]): string {
    const esc = (v: unknown): string => {
      const s = String(v ?? '')
      if (s.includes(this.delimiter) || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    const lines = [headers.map(esc).join(this.delimiter)]
    for (const row of rows) {
      lines.push(headers.map(h => esc(row[h])).join(this.delimiter))
    }
    return lines.join('\n')
  }
}
