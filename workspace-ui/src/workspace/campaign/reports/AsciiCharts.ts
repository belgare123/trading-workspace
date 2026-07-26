/**
 * AsciiCharts.ts — Render equity & drawdown curves as ASCII charts
 *
 * Produces fixed-width text charts suitable for terminal output,
 * Markdown code blocks, or Telegram messages.
 *
 * @since M2-02
 */

import type { CurvePoint } from './types'

export interface AsciiChartOptions {
  /** Chart width in characters (default: 50) */
  width?: number
  /** Chart height in characters (default: 12) */
  height?: number
  /** Label format for Y axis */
  format?: 'short' | 'full'
}

const DEFAULTS: Required<AsciiChartOptions> = {
  width: 50,
  height: 12,
  format: 'short',
}

/**
 * Render an equity curve as a simple ASCII line chart.
 * Points are sampled evenly across the time range.
 */
export function renderEquityCurve(
  points: CurvePoint[],
  options: AsciiChartOptions = {},
): string {
  if (points.length === 0) return '(no data)'
  if (points.length === 1) {
    return `  Equity: $${points[0].equity.toFixed(2)} (only 1 snapshot)`
  }

  const opts = { ...DEFAULTS, ...options }
  return renderLineChart(
    points.map(p => p.equity),
    points.map(p => p.t),
    opts.width,
    opts.height,
    'Equity ($)',
    opts.format,
  )
}

/**
 * Render a drawdown curve (percentage below peak).
 * Values are negative percentages.
 */
export function renderDrawdownCurve(
  points: CurvePoint[],
  options: AsciiChartOptions = {},
): string {
  if (points.length === 0) return '(no data)'

  const opts = { ...DEFAULTS, ...options }
  const ddValues = points.map(p => -(p.drawdownPct ?? 0))

  return renderLineChart(
    ddValues,
    points.map(p => p.t),
    opts.width,
    opts.height,
    'Drawdown (%)',
    opts.format,
  )
}

// ── Internal: generic ASCII line chart ──

function renderLineChart(
  values: number[],
  timestamps: number[],
  width: number,
  height: number,
  label: string,
  format: 'short' | 'full',
): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  // Sample points evenly
  const step = Math.max(1, Math.floor((values.length - 1) / (width - 1)))
  const sampled: number[] = []
  const sampledIdx: number[] = []
  for (let i = 0; i < width; i++) {
    const idx = Math.min(i * step, values.length - 1)
    sampled.push(values[idx])
    sampledIdx.push(idx)
  }

  // Build the chart rows (top to bottom)
  const lines: string[] = []
  const yLabelWidth = format === 'full' ? 14 : 8

  // Title row
  lines.push(`  ${label}`)
  lines.push('')

  for (let row = 0; row < height; row++) {
    const yVal = max - (range * row) / (height - 1)
    const yLabel = format === 'full'
      ? yVal.toFixed(2).padStart(yLabelWidth)
      : abbreviate(yVal).padStart(yLabelWidth)

    let chartLine = ''
    const threshold = yVal
    for (let col = 0; col < sampled.length; col++) {
      if (col === 0) {
        chartLine += '│'
        continue
      }
      const prev = sampled[col - 1]
      const curr = sampled[col]

      if (curr >= threshold && prev >= threshold) {
        chartLine += '█'
      } else if (curr >= threshold || prev >= threshold) {
        chartLine += '▄'
      } else {
        chartLine += ' '
      }
    }

    lines.push(`${yLabel} ${chartLine}`)
  }

  // X axis
  const xAxis = ' '.repeat(yLabelWidth + 1) + '└' + '─'.repeat(sampled.length - 1)
  lines.push(xAxis)

  // Labels
  const firstTs = formatTimestamp(timestamps?.[sampledIdx[0]] ?? 0)
  const lastTs = formatTimestamp(timestamps?.[sampledIdx[sampledIdx.length - 1]] ?? 0)
  const labelLine = ' '.repeat(yLabelWidth + 1) + firstTs.padEnd(sampled.length - firstTs.length - lastTs.length) + lastTs
  lines.push(labelLine)

  return lines.join('\n')
}

function abbreviate(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'K'
  return v.toFixed(1)
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
