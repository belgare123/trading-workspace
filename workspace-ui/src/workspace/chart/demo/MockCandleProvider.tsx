/**
 * MockCandleProvider.ts — React context for mock candle data & sandbox controls
 *
 * Manages:
 *   - Candle count (100/500/1000/5000)
 *   - Symbol selection (BTCUSDT, ETHUSDT)
 *   - Timeframe (1m, 5m, 1h)
 *   - Generated OHLCV data
 *   - Debug overlay visibility
 *   - Grid toggle
 *   - Crosshair toggle
 *   - Viewport reset
 *
 * @since 3.3.2
 */

import { useState, useMemo, createContext, useContext, useCallback } from 'react'
import type { ReactNode } from 'react'
import { generateCandles } from './generateCandles'

export type SandboxSymbol = 'BTCUSDT' | 'ETHUSDT'
export type SandboxTimeframe = '1m' | '5m' | '1h'

export interface SandboxState {
  /** Number of candles to display */
  candleCount: number
  /** Selected symbol */
  symbol: SandboxSymbol
  /** Selected timeframe */
  timeframe: SandboxTimeframe
  /** Generated OHLCV data */
  data: ReturnType<typeof generateCandles>
  /** Toggle grid layer */
  showGrid: boolean
  /** Toggle crosshair layer */
  showCrosshair: boolean
  /** Show debug overlay (FPS, candle count, viewport state) */
  showDebug: boolean
  /** Viewport reset counter (increment to trigger reset) */
  resetKey: number
  /** Active indicator IDs (from IndicatorRegistry) */
  activeIndicators: string[]
  /** Toggle an indicator on/off */
  toggleIndicator: (id: string) => void
  /** Queue a drawing to be added at a default position */
  queueDrawing: (defId: string) => void
  /** Clear all drawings */
  clearDrawings: () => void
  /** Drawing clear counter (incremented on clear) */
  drawingClearKey: number
  /** Drawing queue — pending additions */
  drawingQueue: { defId: string }[]
  /** Reset drawing queue (called by chart canvas after processing) */
  resetDrawingQueue: () => void
  /** Set candle count */
  setCandleCount: (count: number) => void
  /** Set symbol */
  setSymbol: (symbol: SandboxSymbol) => void
  /** Set timeframe */
  setTimeframe: (tf: SandboxTimeframe) => void
  /** Toggle grid */
  toggleGrid: () => void
  /** Toggle crosshair */
  toggleCrosshair: () => void
  /** Toggle debug overlay */
  toggleDebug: () => void
  /** Reset viewport */
  resetViewport: () => void
  /** Regenerate data */
  regenerate: () => void
}

const CANDLE_COUNT_OPTIONS = [100, 500, 1000, 5000] as const

const SYMBOL_CONFIG: Record<SandboxSymbol, { basePrice: number }> = {
  BTCUSDT: { basePrice: 50_000 },
  ETHUSDT: { basePrice: 3_000 },
}

const TIMEFRAME_MS: Record<SandboxTimeframe, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '1h': 3_600_000,
}

function buildData(
  candleCount: number,
  symbol: SandboxSymbol,
  _timeframe: SandboxTimeframe,
) {
  const basePrice = SYMBOL_CONFIG[symbol].basePrice
  return generateCandles({
    count: candleCount,
    basePrice,
    intervalMs: TIMEFRAME_MS[_timeframe],
  })
}

const SandboxContext = createContext<SandboxState | null>(null)

export function MockCandleProvider({ children }: { children: ReactNode }) {
  const [candleCount, setCandleCount] = useState(500)
  const [symbol, setSymbol] = useState<SandboxSymbol>('BTCUSDT')
  const [timeframe, setTimeframe] = useState<SandboxTimeframe>('1m')
  const [showGrid, setShowGrid] = useState(true)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [showDebug, setShowDebug] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const [genKey, setGenKey] = useState(0)
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['SMA', 'EMA', 'VWAP'])
  const [drawingQueue, setDrawingQueue] = useState<{ defId: string }[]>([])
  const [drawingClearKey, setDrawingClearKey] = useState(0)

  const data = useMemo(
    () => buildData(candleCount, symbol, timeframe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candleCount, symbol, timeframe, genKey],
  )

  const toggleGrid = useCallback(() => setShowGrid((v) => !v), [])
  const toggleCrosshair = useCallback(() => setShowCrosshair((v) => !v), [])
  const toggleDebug = useCallback(() => setShowDebug((v) => !v), [])
  const resetViewport = useCallback(() => setResetKey((k) => k + 1), [])
  const regenerate = useCallback(() => setGenKey((k) => k + 1), [])
  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])
  const queueDrawing = useCallback((defId: string) => {
    setDrawingQueue((prev) => [...prev, { defId }])
  }, [])
  const clearDrawings = useCallback(() => {
    setDrawingClearKey((k) => k + 1)
    setDrawingQueue([])
  }, [])
  const resetDrawingQueue = useCallback(() => {
    setDrawingQueue([])
  }, [])

  const value: SandboxState = {
    candleCount,
    symbol,
    timeframe,
    data,
    showGrid,
    showCrosshair,
    showDebug,
    resetKey,
    activeIndicators,
    toggleIndicator,
    queueDrawing,
    clearDrawings,
    drawingClearKey,
    drawingQueue,
    resetDrawingQueue,
    setCandleCount,
    setSymbol,
    setTimeframe,
    toggleGrid,
    toggleCrosshair,
    toggleDebug,
    resetViewport,
    regenerate,
  }

  return (
    <SandboxContext.Provider value={value}>
      {children}
    </SandboxContext.Provider>
  )
}

export function useSandbox(): SandboxState {
  const ctx = useContext(SandboxContext)
  if (!ctx) throw new Error('useSandbox must be used within MockCandleProvider')
  return ctx
}

export { CANDLE_COUNT_OPTIONS, SYMBOL_CONFIG, TIMEFRAME_MS }
