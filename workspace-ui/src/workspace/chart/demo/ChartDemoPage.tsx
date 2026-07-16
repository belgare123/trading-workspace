/**
 * ChartDemoPage.tsx — Chart Sandbox main page
 *
 * Standalone demo page that validates the full rendering pipeline
 * without requiring Workspace or Dashboard.
 *
 * Manages its own canvas, RenderLoop, and all layers so that
 * visibility toggles (grid, crosshair) are handled locally.
 *
 * @since 3.3.2
 */

import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { ChartDemoToolbar } from './ChartDemoToolbar'
import { MockCandleProvider, useSandbox } from './MockCandleProvider'
import { ChartViewport } from '../viewport/ChartViewport'
import { RenderLoop } from '../rendering/RenderLoop'
import { GridRenderer } from '../rendering/GridRenderer'
import { CandleRenderer } from '../rendering/CandleRenderer'
import { AxisRenderer } from '../rendering/AxisRenderer'
import { CrosshairRenderer } from '../rendering/CrosshairRenderer'
import { IndicatorRenderer } from '../indicators/IndicatorRenderer'
import { IndicatorRuntime } from '../indicators/IndicatorRuntime'
import { RENDER_PASSES } from '../rendering/types'
import { registerBuiltinIndicators } from '../indicators/builtins/index'
import { registerAllDrawingBuiltins } from '../drawing/builtins/index'
import { DrawingRenderer } from '../drawing/DrawingRenderer'
import { InteractionRuntime } from '../interaction/InteractionRuntime'
import { OverlayRenderer } from '../overlay/OverlayRenderer'
import { registerAllOverlayBuiltins } from '../overlay/builtins/index'
import type { ToolMode } from '../interaction/types'
import type { IRenderContext } from '../rendering/types'
import type { TimeScaleOptions, PriceScaleOptions } from '../types'

// Register built-in indicators, drawing tools, and overlays once at module load
registerBuiltinIndicators()
registerAllDrawingBuiltins()
registerAllOverlayBuiltins()

// ── Viewport config (shared across resets) ──

function makeViewportConfig() {
  return {
    offsetX: 0,
    offsetY: 0,
    zoomX: 1,
    zoomY: 1,
  }
}

function makeTimeScale(from?: number, to?: number): TimeScaleOptions {
  const f = from ?? Date.now() - 500 * 60_000
  const t = to ?? Date.now()
  return {
    visible: true,
    rangeMs: t - f,
    from: f,
    to: t,
  }
}

function makePriceScale(fixedMin?: number, fixedMax?: number): PriceScaleOptions {
  return {
    visible: true,
    position: 'right',
    inverted: false,
    logarithmic: false,
    fixedMin,
    fixedMax,
  }
}

// ── Debug overlay ──

interface DebugInfo {
  frameCount: number
  lastFrameTime: number
  fps: number
}

function ChartDebugOverlay({ viewport, candleCount, debug }: {
  viewport: ChartViewport | null
  candleCount: number
  debug: DebugInfo
}) {
  if (!viewport) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        padding: '6px 10px',
        background: 'rgba(22, 22, 42, 0.85)',
        borderRadius: 4,
        fontFamily: 'Consolas, monospace',
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        lineHeight: 1.6,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      <div>FPS: <span style={{ color: debug.fps > 30 ? '#26a69a' : '#ef5350' }}>{debug.fps.toFixed(1)}</span></div>
      <div>Candles: {candleCount}</div>
      <div>Frames: {debug.frameCount}</div>
      <div>Zoom: {viewport.viewport.zoomX.toFixed(2)}x</div>
      <div>Offset: ({viewport.viewport.offsetX.toFixed(0)}, {viewport.viewport.offsetY.toFixed(0)})</div>
      <div>Range: [{viewport.timeScale.from.toFixed(0)}, {viewport.timeScale.to.toFixed(0)}]</div>
    </div>
  )
}

// ── Chart canvas component ──

function ChartCanvas({ resetKey, interactionRuntimeRef }: {
  resetKey: number
  interactionRuntimeRef: React.MutableRefObject<InteractionRuntime | null>
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<ChartViewport | null>(null)
  const loopRef = useRef<RenderLoop | null>(null)
  const gridRef = useRef<GridRenderer | null>(null)
  const crosshairRef = useRef<CrosshairRenderer | null>(null)
  const drawingRendererRef = useRef<DrawingRenderer | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const debugRef = useRef<DebugInfo>({ frameCount: 0, lastFrameTime: 0, fps: 60 })

  const { data, showGrid, showCrosshair, showDebug, activeIndicators, drawingQueue, drawingClearKey, resetDrawingQueue } = useSandbox()

  // Memoize viewport config (changes when data changes — update timescale range)
  const timeScale = useMemo(
    () => {
      if (data.length === 0) return makeTimeScale()
      return makeTimeScale(data[0].timestamp, data[data.length - 1].timestamp)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resetKey, data.length],
  )

  // ── Initialize canvas + render loop ──
  useEffect(() => {
    const container = containerRef.current
    if (!container || data.length === 0) return

    // Compute price range from data
    let priceMin = Infinity
    let priceMax = -Infinity
    for (const d of data) {
      if (d.low < priceMin) priceMin = d.low
      if (d.high > priceMax) priceMax = d.high
    }
    const padding = (priceMax - priceMin) * 0.1 || priceMax * 0.1

    const vp = new ChartViewport(
      makeViewportConfig(),
      { ...timeScale, from: data[0].timestamp, to: data[data.length - 1].timestamp },
      makePriceScale(priceMin - padding, priceMax + padding),
    )
    viewportRef.current = vp

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0'
    container.appendChild(canvas)
    canvasRef.current = canvas

    const grid = new GridRenderer()
    const candles = new CandleRenderer()
    candles.data = data
    const axes = new AxisRenderer()
    const crosshair = new CrosshairRenderer()
    const indicatorRuntime = new IndicatorRuntime()
    const indicatorRenderer = new IndicatorRenderer(indicatorRuntime)
    const drawingRenderer = new DrawingRenderer()
    const overlayRenderer = new OverlayRenderer()
    gridRef.current = grid
    crosshairRef.current = crosshair
    drawingRendererRef.current = drawingRenderer

    // Pre-compute initial indicators
    indicatorRuntime.updateData(data)

    const loop = new RenderLoop([RENDER_PASSES.main])
    loop.addLayer(grid)
    loop.addLayer(candles)
    loop.addLayer(axes)
    loop.addLayer(crosshair)
    loop.addLayer(indicatorRenderer)
    loop.addLayer(drawingRenderer)
    loop.addLayer(overlayRenderer)
    loopRef.current = loop

    // Initialize layers
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      const w = rect.width * dpr
      const h = rect.height * dpr

      const renderCtx: IRenderContext = { ctx, viewport: vp, width: w, height: h, dpr, visibleData: data }
      grid.initialize(renderCtx)
      candles.initialize(renderCtx)
      axes.initialize(renderCtx)
      crosshair.initialize(renderCtx)
      indicatorRenderer.initialize(renderCtx)
      drawingRenderer.initialize(renderCtx)
      overlayRenderer.initialize(renderCtx)
      grid.resize(w, h, dpr)
      candles.resize(w, h, dpr)
      axes.resize(w, h, dpr)
      crosshair.resize(w, h, dpr)
      indicatorRenderer.resize(w, h, dpr)
      drawingRenderer.resize(w, h, dpr)
      overlayRenderer.resize(w, h, dpr)
      loop.setContext(renderCtx)
    }

    // FPS tracking
    let frameCount = 0
    let lastTime = performance.now()
    loop.onFrame = () => {
      frameCount++
      const now = performance.now()
      const elapsed = now - lastTime
      if (elapsed >= 1000) {
        debugRef.current = {
          frameCount,
          lastFrameTime: now,
          fps: (frameCount * 1000) / elapsed,
        }
        frameCount = 0
        lastTime = now
      }
    }

    loop.start()

    // ── Interaction Runtime ──
    const intRuntime = new InteractionRuntime()
    intRuntime.connect({
      setCursor: (cursor) => { canvas.style.cursor = cursor },
      requestRender: () => { /* RenderLoop renders continuously — no-op */ },
      setHovered: () => { /* hover highlight TBD */ },
    })
    interactionRuntimeRef.current = intRuntime

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { inlineSize: w, blockSize: h } = entry.contentBoxSize[0]
        const dpr = window.devicePixelRatio || 1
        const pw = w * dpr
        const ph = h * dpr

        canvas.width = pw
        canvas.height = ph
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`

        vp.setSize(w, h)

        const currentCtx = canvas.getContext('2d')
        if (currentCtx) {
          loop.setContext({
            ctx: currentCtx,
            viewport: vp,
            width: pw,
            height: ph,
            dpr,
            visibleData: candles.data,
          })
        }
        for (const layerId of ['grid', 'candles', 'axis', 'crosshair', 'indicators', 'drawings', 'overlay'] as const) {
          loop.getLayer(layerId)?.resize(pw, ph, dpr)
        }
      }
    })
    ro.observe(container)

    return () => {
      loop.stop()
      loop.destroy()
      ro.disconnect()
      canvas.remove()
      intRuntime.reset()
      interactionRuntimeRef.current = null
      loopRef.current = null
      viewportRef.current = null
      canvasRef.current = null
      gridRef.current = null
      crosshairRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // ── Sync data ──
  useEffect(() => {
    const loop = loopRef.current
    if (!loop) return
    const layer = loop.getLayer('candles') as CandleRenderer | undefined
    if (layer) layer.data = data

    // Recompute indicators on new data
    const indRenderer = loop.getLayer('indicators') as IndicatorRenderer | undefined
    if (indRenderer?.runtime) {
      indRenderer.runtime.recomputeAll(data)
    }
  }, [data])

  // ── Sync active indicators ──
  useEffect(() => {
    const loop = loopRef.current
    if (!loop) return
    const indRenderer = loop.getLayer('indicators') as IndicatorRenderer | undefined
    const rt = indRenderer?.runtime
    if (!rt) return

    // Build set of desired indicator IDs
    const desired = new Set(activeIndicators)

    // Remove instances not in desired set
    for (const inst of rt.getAll()) {
      if (!desired.has(inst.definition.id)) {
        rt.remove(inst.instanceId)
      }
    }

    // Add instances for IDs not yet active
    for (const id of activeIndicators) {
      const exists = rt.getAll().some((i) => i.definition.id === id)
      if (!exists) {
        try {
          rt.add(id)
        } catch {
          // Indicator not registered — skip
        }
      }
    }
  }, [activeIndicators])

  // ── Process drawing queue ──
  useEffect(() => {
    const drawer = drawingRendererRef.current
    if (!drawer || data.length === 0 || drawingQueue.length === 0) return

    const rt = drawer.runtime

    for (const item of drawingQueue) {
      // Pick a default position: middle of the visible data
      const midIdx = Math.floor(data.length / 2)
      const midCandle = data[midIdx]
      const offset = Math.floor(data.length * 0.1)

      switch (item.defId) {
        case 'trend-line':
          rt.add('trend-line', [
            { time: data[Math.max(0, midIdx - offset)].timestamp, price: midCandle.high * 1.02 },
            { time: data[Math.min(data.length - 1, midIdx + offset)].timestamp, price: midCandle.low * 0.98 },
          ])
          break
        case 'horizontal-line':
          rt.add('horizontal-line', [{ time: midCandle.timestamp, price: midCandle.close }])
          break
        case 'vertical-line':
          rt.add('vertical-line', [{ time: midCandle.timestamp, price: midCandle.close }])
          break
        case 'ray':
          rt.add('ray', [
            { time: data[Math.max(0, midIdx - offset)].timestamp, price: midCandle.low },
            { time: midCandle.timestamp, price: midCandle.high },
          ])
          break
        case 'rectangle':
          rt.add('rectangle', [
            { time: data[Math.max(0, midIdx - offset)].timestamp, price: midCandle.high * 1.05 },
            { time: data[Math.min(data.length - 1, midIdx + offset)].timestamp, price: midCandle.low * 0.95 },
          ])
          break
        case 'text':
          rt.add('text', [{ time: midCandle.timestamp, price: midCandle.high }])
          break
        case 'fib-retracement':
          rt.add('fib-retracement', [
            { time: data[Math.max(0, midIdx - offset)].timestamp, price: midCandle.low },
            { time: data[Math.min(data.length - 1, midIdx + offset)].timestamp, price: midCandle.high },
          ])
          break
      }
    }

    // Clear the queue so the same items aren't re-processed
    resetDrawingQueue()
  }, [drawingQueue, data, resetDrawingQueue])

  // ── Clear all drawings ──
  useEffect(() => {
    if (drawingClearKey === 0) return
    const drawer = drawingRendererRef.current
    if (!drawer) return
    drawer.runtime.clear()
  }, [drawingClearKey])

  // ── Demo overlay data ──
  useEffect(() => {
    const loop = loopRef.current
    if (!loop || data.length < 10) return
    const olLayer = loop.getLayer('overlay') as OverlayRenderer | undefined
    if (!olLayer) return
    const rt = olLayer.runtime

    // Clear previous overlays
    rt.clear()

    // 1. Price markers at key levels
    const priceHigh = Math.max(...data.map(d => d.high))
    const priceLow = Math.min(...data.map(d => d.low))
    const priceMid = (priceHigh + priceLow) / 2
    rt.add('price-marker', { price: priceHigh }, { label: `High ${priceHigh.toFixed(2)}`, color: '#ef9a9a' })
    rt.add('price-marker', { price: priceLow }, { label: `Low ${priceLow.toFixed(2)}`, color: '#a5d6a7' })
    rt.add('price-marker', { price: priceMid }, { label: `Mid ${priceMid.toFixed(2)}`, color: '#90caf9', lineWidth: 0.5 })

    // 2. Session box (middle 40% of the visible range as a Tokyo session)
    const startIdx = Math.floor(data.length * 0.3)
    const endIdx = Math.floor(data.length * 0.7)
    const sessionStart = data[startIdx].timestamp
    const sessionEnd = data[endIdx].timestamp
    rt.add('session-box', {}, {
      startTime: sessionStart,
      endTime: sessionEnd,
      label: 'Tokyo Session',
      color: 'rgba(255, 183, 77, 0.08)',
    })

    // 3. Mock buy order
    const buyIdx = Math.floor(data.length * 0.4)
    rt.add('order-marker', { time: data[buyIdx].timestamp, price: data[buyIdx].low },
      { side: 'buy', quantity: 1.5, label: '1.5' })

    // 4. Mock position
    const entryIdx = Math.floor(data.length * 0.25)
    const exitIdx = Math.floor(data.length * 0.65)
    const entryPrice = data[entryIdx].close
    const exitPrice = data[exitIdx].close
    const pnl = ((exitPrice - entryPrice) / entryPrice) * 100
    rt.add('position-marker', { time: data[entryIdx].timestamp, price: data[entryIdx].close },
      { side: 'long', entryPrice, exitPrice, quantity: 1000, pnl, label: `+${pnl.toFixed(2)}%` })

    // 5. Volume profile (compute volume levels from first half of data)
    const volumeLevels: { price: number; volume: number }[] = []
    const bucketCount = 20
    const minPrice = priceLow
    const maxPrice = priceHigh
    const step = (maxPrice - minPrice) / bucketCount
    const buckets = new Array(bucketCount).fill(0)
    for (const d of data) {
      const bucketIdx = Math.min(bucketCount - 1, Math.floor((d.close - minPrice) / step))
      buckets[bucketIdx] += d.volume
    }
    for (let i = 0; i < bucketCount; i++) {
      volumeLevels.push({ price: minPrice + step * i + step / 2, volume: buckets[i] })
    }
    rt.add('volume-profile', {}, { levels: volumeLevels, barWidth: 60, color: 'rgba(38, 166, 154, 0.25)' })

    // 6. Alert at the close
    const lastCandle = data[data.length - 1]
    rt.add('alert-marker', { time: lastCandle.timestamp, price: lastCandle.high * 1.02 },
      { label: 'Resistance', color: '#ffa726' })
  }, [data])

  // ── Toggle grid visibility ──
  useEffect(() => {
    const loop = loopRef.current
    if (!loop) return
    const layer = loop.getLayer('grid')
    if (!layer) return
    if (showGrid) {
      loop.addLayer(gridRef.current!)
    } else if (gridRef.current) {
      loop.removeLayer('grid')
    }
  }, [showGrid])

  // ── Toggle crosshair visibility ──
  useEffect(() => {
    const loop = loopRef.current
    if (!loop) return
    if (showCrosshair) {
      loop.addLayer(crosshairRef.current!)
    } else if (crosshairRef.current) {
      loop.removeLayer('crosshair')
    }
  }, [showCrosshair])

  // ── Pointer events ──
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ clientX: 0, clientY: 0, offsetX: 0, offsetY: 0 })
  const interactionActiveRef = useRef(false)

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    const vp = viewportRef.current
    const ch = crosshairRef.current
    const intRt = interactionRuntimeRef.current
    if (!canvas || !vp || !ch) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const pixelX = (e.clientX - rect.left) * dpr
    const pixelY = (e.clientY - rect.top) * dpr

    // Interaction route (drawing tool active or drag/resize gesture)
    if (intRt && (interactionActiveRef.current || intRt.toolMode !== 'select')) {
      const ctx = InteractionRuntime.makeHitContext(
        (t: number) => vp.timeToPixel(t),
        (p: number) => vp.priceToPixel(p),
      )
      intRt.router.pointerMove(
        { pixelX, pixelY, marketTime: vp.pixelToTime(pixelX), marketPrice: vp.pixelToPrice(pixelY), altKey: e.altKey, shiftKey: e.shiftKey },
        intRt.toolMode,
        drawingRendererRef.current!.runtime,
        intRt.hitTest,
        intRt.selection,
        intRt.drag,
        intRt.resize,
        intRt.cursor,
        ctx,
      )
      ch.position = {
        pixelX, pixelY,
        timestamp: vp.pixelToTime(pixelX),
        price: vp.pixelToPrice(pixelY),
        visible: true,
      }
      return
    }

    // Existing pan/crosshair behavior (select mode with no active gesture)
    if (draggingRef.current) {
      const dx = (e.clientX - dragStartRef.current.clientX) * dpr
      const dy = (e.clientY - dragStartRef.current.clientY) * dpr
      vp.setOffset(dragStartRef.current.offsetX + dx, dragStartRef.current.offsetY + dy)
    } else {
      ch.position = {
        pixelX, pixelY,
        timestamp: vp.pixelToTime(pixelX),
        price: vp.pixelToPrice(pixelY),
        visible: true,
      }
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const vp = viewportRef.current
    const intRt = interactionRuntimeRef.current
    const dr = drawingRendererRef.current
    if (!vp) return

    if (intRt && dr) {
      const dpr = window.devicePixelRatio || 1
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const pixelX = (e.clientX - rect.left) * dpr
      const pixelY = (e.clientY - rect.top) * dpr
      const ctx = InteractionRuntime.makeHitContext(
        (t: number) => vp.timeToPixel(t),
        (p: number) => vp.priceToPixel(p),
      )

      if (intRt.toolMode !== 'select') {
        // Drawing tool — route to InteractionRuntime for creation
        intRt.router.pointerDown(
          { pixelX, pixelY, marketTime: vp.pixelToTime(pixelX), marketPrice: vp.pixelToPrice(pixelY), altKey: e.altKey, shiftKey: e.shiftKey },
          intRt.toolMode, dr.runtime, intRt.hitTest, intRt.selection,
          intRt.toolController, intRt.drag, intRt.resize, ctx,
        )
        interactionActiveRef.current = true
        return
      }

      // Select mode — hit-test first
      const hit = intRt.hitTest.hitTest(pixelX, pixelY, dr.runtime, ctx)
      if (hit) {
        // Hit an object — route to InteractionRuntime for selection/drag
        intRt.router.pointerDown(
          { pixelX, pixelY, marketTime: vp.pixelToTime(pixelX), marketPrice: vp.pixelToPrice(pixelY), altKey: e.altKey, shiftKey: e.shiftKey },
          intRt.toolMode, dr.runtime, intRt.hitTest, intRt.selection,
          intRt.toolController, intRt.drag, intRt.resize, ctx,
        )
        interactionActiveRef.current = true
        return
      }

      // No hit — deselect and start pan
      intRt.selection.clearSelection()
      intRt.selection.setActive(null)
    }

    // Existing pan behavior
    draggingRef.current = true
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      offsetX: vp.viewport.offsetX,
      offsetY: vp.viewport.offsetY,
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    const intRt = interactionRuntimeRef.current
    draggingRef.current = false
    if (interactionActiveRef.current && intRt) {
      interactionActiveRef.current = false
      intRt.router.pointerUp(intRt.drag, intRt.resize)
    }
  }, [])
  const handlePointerLeave = useCallback(() => {
    draggingRef.current = false
    interactionActiveRef.current = false
    const intRt = interactionRuntimeRef.current
    if (intRt) {
      intRt.router.pointerLeave(intRt.selection, intRt.cursor)
    }
    if (crosshairRef.current) {
      crosshairRef.current.position = { ...crosshairRef.current.position, visible: false }
    }
  }, [])

  // ── Wheel zoom ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const vp = viewportRef.current
    if (!vp) return

    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    vp.viewport.zoomX = Math.max(0.1, Math.min(50, vp.viewport.zoomX * factor))
    vp.viewport.zoomY = Math.max(0.1, Math.min(50, vp.viewport.zoomY * factor))
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
    >
      {showDebug && (
        <ChartDebugOverlay
          viewport={viewportRef.current}
          candleCount={data.length}
          debug={debugRef.current}
        />
      )}
    </div>
  )
}

// ── Main page ──

export function ChartDemoPage() {
  const { resetKey } = useSandbox()
  const [activeTool, setActiveTool] = useState<ToolMode>('select')
  const interactionRuntimeRef = useRef<InteractionRuntime | null>(null)

  const handleToolActivate = useCallback((tool: ToolMode) => {
    setActiveTool(tool)
    interactionRuntimeRef.current?.activateTool(tool)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: '#1a1a2e',
        color: 'rgba(255,255,255,0.8)',
        overflow: 'hidden',
      }}
    >
      <ChartDemoToolbar activeTool={activeTool} onToolActivate={handleToolActivate} />
      <div style={{ flex: 1, position: 'relative' }}>
        <ChartCanvas resetKey={resetKey} interactionRuntimeRef={interactionRuntimeRef} />
      </div>
    </div>
  )
}

// ── Standalone page wrapper (used by App.tsx route) ──

export function ChartSandboxStandalone() {
  return (
    <MockCandleProvider>
      <ChartDemoPage />
    </MockCandleProvider>
  )
}
