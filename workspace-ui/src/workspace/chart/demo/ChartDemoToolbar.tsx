/**
 * ChartDemoToolbar.tsx — sandbox toolbar controls
 *
 * Minimal panel for:
 *   - Symbol selection (BTCUSDT, ETHUSDT)
 *   - Timeframe (1m, 5m, 1h)
 *   - Candle count (100/500/1000/5000)
 *   - Reset Viewport
 *   - Toggle Grid / Crosshair / Debug
 *
 * @since 3.3.2
 */

import { useSandbox } from './MockCandleProvider'
import { CANDLE_COUNT_OPTIONS } from './sandboxConstants'
import type { SandboxSymbol, SandboxTimeframe } from './MockCandleProvider'
import { IndicatorRegistry } from '../indicators/IndicatorRegistry'
import { DrawingRegistry } from '../drawing/DrawingRegistry'
import type { ToolMode } from '../interaction/types'

const SYMBOLS: SandboxSymbol[] = ['BTCUSDT', 'ETHUSDT']
const TIMEFRAMES: SandboxTimeframe[] = ['1m', '5m', '1h']

const btnBase: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)',
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'Consolas, monospace',
  whiteSpace: 'nowrap',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'rgba(38,166,154,0.25)',
  borderColor: '#26a69a',
  color: '#26a69a',
}

const label: React.CSSProperties = {
  color: 'rgba(255,255,255,0.35)',
  fontSize: 11,
  fontFamily: 'Consolas, monospace',
  marginRight: 6,
}

const group: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const spacer32: React.CSSProperties = { width: 32, flexShrink: 0 }

interface ChartDemoToolbarProps {
  activeTool: ToolMode | null
  onToolActivate: (tool: ToolMode) => void
}

export function ChartDemoToolbar({ activeTool, onToolActivate }: ChartDemoToolbarProps) {
  const {
    candleCount,
    symbol,
    timeframe,
    showGrid,
    showCrosshair,
    showDebug,
    activeIndicators,
    setCandleCount,
    setSymbol,
    setTimeframe,
    toggleGrid,
    toggleCrosshair,
    toggleDebug,
    resetViewport,
    regenerate,
    toggleIndicator,
    queueDrawing,
    clearDrawings,
  } = useSandbox()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        background: '#16162a',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
        minHeight: 36,
        userSelect: 'none',
      }}
    >
      {/* Symbol */}
      <div style={group}>
        <span style={label}>Symbol</span>
        {SYMBOLS.map((s) => (
          <button
            key={s}
            style={s === symbol ? btnActive : btnBase}
            onClick={() => setSymbol(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={spacer32} />

      {/* Timeframe */}
      <div style={group}>
        <span style={label}>TF</span>
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            style={tf === timeframe ? btnActive : btnBase}
            onClick={() => setTimeframe(tf)}
          >
            {tf}
          </button>
        ))}
      </div>

      <div style={spacer32} />

      {/* Candle count */}
      <div style={group}>
        <span style={label}>Count</span>
        {CANDLE_COUNT_OPTIONS.map((n) => (
          <button
            key={n}
            style={n === candleCount ? btnActive : btnBase}
            onClick={() => setCandleCount(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <div style={spacer32} />

      {/* Actions */}
      <button
        style={{ ...btnBase, borderColor: 'rgba(255,255,255,0.25)' }}
        onClick={resetViewport}
      >
        Reset View
      </button>

      <button
        style={{ ...btnBase, borderColor: 'rgba(255,255,255,0.25)' }}
        onClick={regenerate}
      >
        Re-gen
      </button>

      <div style={{ flex: 1 }} />

      {/* Toggles */}
      <button style={showGrid ? btnActive : btnBase} onClick={toggleGrid}>
        Grid
      </button>
      <button
        style={showCrosshair ? btnActive : btnBase}
        onClick={toggleCrosshair}
      >
        Crosshair
      </button>
      <button style={showDebug ? btnActive : btnBase} onClick={toggleDebug}>
        Debug
      </button>

      {/* Indicators */}
      <div style={{ ...spacer32, width: 16 }} />
      {IndicatorRegistry.list().map((def) => (
        <button
          key={def.id}
          style={activeIndicators.includes(def.id) ? {
            ...btnActive,
            borderLeft: `3px solid ${def.outputs[0]?.color ?? '#888'}`,
          } : {
            ...btnBase,
            borderLeft: `3px solid transparent`,
          }}
          onClick={() => toggleIndicator(def.id)}
        >
          {def.id}
        </button>
      ))}

      {/* Drawing Tools (interactive placement) */}
      <div style={{ ...spacer32, width: 16 }} />
      {[
        { id: 'select' as ToolMode, name: 'Select', color: '#888' },
        { id: 'trend-line' as ToolMode, name: 'Trend', color: '#8B5CF6' },
        { id: 'horizontal-line' as ToolMode, name: 'H-Line', color: '#F59E0B' },
        { id: 'vertical-line' as ToolMode, name: 'V-Line', color: '#10B981' },
        { id: 'rectangle' as ToolMode, name: 'Rect', color: '#3B82F6' },
        { id: 'text' as ToolMode, name: 'Text', color: '#FFFFFF' },
        { id: 'fib' as ToolMode, name: 'Fib', color: '#8B5CF6' },
      ].map(({ id, name, color }) => (
        <button
          key={id}
          style={activeTool === id ? {
            ...btnActive,
            borderLeft: `3px solid ${color}`,
          } : {
            ...btnBase,
            borderLeft: `3px solid transparent`,
          }}
          onClick={() => onToolActivate(id)}
        >
          {name}
        </button>
      ))}

      {/* Quick-add drawing buttons (instant via queue, for demo) */}
      <div style={{ ...spacer32, width: 8 }} />
      {DrawingRegistry.list().map((def) => {
        const colors: Record<string, string> = {
          'trend-line': '#8B5CF6',
          'horizontal-line': '#F59E0B',
          'vertical-line': '#10B981',
          ray: '#EC4899',
          rectangle: '#3B82F6',
          text: '#FFFFFF',
          'fib-retracement': '#8B5CF6',
        }
        return (
          <button
            key={def.id}
            style={{
              ...btnBase,
              fontSize: 10,
              borderLeft: `3px solid ${colors[def.id] ?? '#888'}`,
            }}
            onClick={() => queueDrawing(def.id)}
          >
            +{def.name}
          </button>
        )
      })}
      <button
        style={{ ...btnBase, borderColor: 'rgba(255,80,80,0.4)', color: '#ef5350' }}
        onClick={clearDrawings}
      >
        Clear
      </button>
    </div>
  )
}