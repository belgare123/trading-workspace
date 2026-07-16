/** — ChartDemoPage.tsx — Chart Sandbox main page (Multi-Pane) —
 *
 * Standalone demo page that validates the multi-pane rendering pipeline.
 * Three vertical panes: Main (candles, overlay indicators, drawings, overlays),
 * RSI (subchart), and MACD (subchart). All panes share a TimeScale and crosshair.
 *
 * @since 3.3.7
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { ChartDemoToolbar } from './ChartDemoToolbar'
import { MockCandleProvider, useSandbox } from './MockCandleProvider'
import { ChartViewport } from '../viewport/ChartViewport'
import { RenderLoop } from '../rendering/RenderLoop'
import { GridRenderer } from '../rendering/GridRenderer'
import { CandleRenderer } from '../rendering/CandleRenderer'
import { RENDER_PASSES } from '../rendering/types'
import { registerBuiltinIndicators } from '../indicators/builtins/index'
import { registerAllDrawingBuiltins } from '../drawing/builtins/index'
import { DrawingRenderer } from '../drawing/DrawingRenderer'
import { OverlayRenderer } from '../overlay/OverlayRenderer'
import { registerAllOverlayBuiltins } from '../overlay/builtins/index'
import { PaneRuntime } from '../composition/PaneRuntime'
import { PaneLayout } from '../composition/PaneLayout'
import { PaneRenderer } from '../composition/PaneRenderer'
import { SynchronizationRuntime } from '../composition/SynchronizationRuntime'
import { IndicatorRuntime } from '../indicators/IndicatorRuntime'
import { InteractionRuntime } from '../interaction/InteractionRuntime'
import type { ToolMode } from '../interaction/types'
import type { IRenderContext } from '../rendering/types'

// Register builtins once at module load
registerBuiltinIndicators()
registerAllDrawingBuiltins()
registerAllOverlayBuiltins()

// — Viewport helpers —

function makeViewportConfig() {
  return { offsetX: 0, offsetY: 0, zoomX: 1, zoomY: 1 }
}

// — Debug overlay —

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
        position: 'absolute', top: 4, right: 4,
        padding: '6px 10px', background: 'rgba(22, 22, 42, 0.85)',
        borderRadius: 4, fontFamily: 'Consolas, monospace', fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.6,
        pointerEvents: 'none', zIndex: 100,
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

// — Chart canvas component (multi-pane) —

function ChartCanvas({ resetKey, interactionRuntimeRef }: {
  resetKey: number
  interactionRuntimeRef: React.MutableRefObject<InteractionRuntime | null>
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<ChartViewport | null>(null)
  const loopRef = useRef<RenderLoop | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const paneRendererRef = useRef<PaneRenderer | null>(null)
  const syncRuntimeRef = useRef<SynchronizationRuntime | null>(null)
  const debugRef = useRef<DebugInfo>({ frameCount: 0, lastFrameTime: 0, fps: 60 })

  // Per-pane indicator runtimes (used outside init effect for indicator sync)
  const mainRuntimeRef = useRef<IndicatorRuntime | null>(null)
  const rsiRuntimeRef = useRef<IndicatorRuntime | null>(null)
  const macdRuntimeRef = useRef<IndicatorRuntime | null>(null)

  const { data, showGrid, showDebug, activeIndicators, drawingQueue, drawingClearKey, resetDrawingQueue } = useSandbox()

  // — Init canvas + render loop (multi-pane) —
  useEffect(() => {
    const container = containerRef.current
    if (!container || data.length === 0) return

    // Price range from data
    let priceMin = Infinity, priceMax = -Infinity
    for (const d of data) {
      if (d.low < priceMin) priceMin = d.low
      if (d.high > priceMax) priceMax = d.high
    }
    const padding = (priceMax - priceMin) * 0.1 || priceMax * 0.1

    // — SynchronizationRuntime (shared TimeScale + crosshair + price scales) —
    const syncRuntime = new SynchronizationRuntime(
      { visible: true, rangeMs: data[data.length - 1].timestamp - data[0].timestamp, from: data[0].timestamp, to: data[data.length - 1].timestamp },
      makeViewportConfig(),
    )
    syncRuntime.priceScales.setFixed('main', priceMin - padding, priceMax + padding)
    syncRuntime.priceScales.setFixed('rsi', 0, 100)
    syncRuntime.priceScales.setFixed('macd', -10, 10)
    syncRuntimeRef.current = syncRuntime

    // — PaneRuntime: 3 panes —
    const paneRuntime = new PaneRuntime()
    const mainPane = paneRuntime.add('main-chart', 0.55)
    const rsiPane = paneRuntime.add('rsi-pane', 0.20)
    const macdPane = paneRuntime.add('macd-pane', 0.25)

    // — Per-pane IndicatorRuntimes —
    const mainRt = new IndicatorRuntime()
    const rsiRt = new IndicatorRuntime()
    const macdRt = new IndicatorRuntime()
    const paneIndicatorRuntimes = new Map<string, IndicatorRuntime>()
    paneIndicatorRuntimes.set(mainPane.id, mainRt)
    paneIndicatorRuntimes.set(rsiPane.id, rsiRt)
    paneIndicatorRuntimes.set(macdPane.id, macdRt)
    mainRuntimeRef.current = mainRt
    rsiRuntimeRef.current = rsiRt
    macdRuntimeRef.current = macdRt

    // Pre-compute (initial indicators will be added by the activeIndicators effect)
    mainRt.updateData(data)
    rsiRt.updateData(data)
    macdRt.updateData(data)

    // — Canvas —
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0'
    container.appendChild(canvas)
    canvasRef.current = canvas

    // — Sub-renderers —
    const grid = new GridRenderer()
    const candles = new CandleRenderer()
    candles.data = data
    const drawingRenderer = new DrawingRenderer()
    const overlayRenderer = new OverlayRenderer()

    // — PaneLayout + PaneRenderer —
    const paneLayout = new PaneLayout()
    const paneRenderer = new PaneRenderer({
      paneRuntime,
      paneLayout,
      syncRuntime,
      gridRenderer: grid,
      candleRenderer: candles,
      paneIndicatorRuntimes,
      drawingRenderer,
      overlayRenderer,
    })
    paneRendererRef.current = paneRenderer

    // — Main ChartViewport (for mouse interaction) —
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      const w = rect.width * dpr
      const h = rect.height * dpr
      const mainVp = new ChartViewport(
        syncRuntime.viewport,
        syncRuntime.timeScale,
        syncRuntime.priceScales.get('main'),
        w, h,
      )
      viewportRef.current = mainVp

      const renderCtx: IRenderContext = { ctx, viewport: mainVp, width: w, height: h, dpr, visibleData: data }
      paneRenderer.initialize(renderCtx)
      paneRenderer.resize(w, h, dpr)
    }

    // — RenderLoop (only PaneRenderer) —
    const loop = new RenderLoop([RENDER_PASSES.main])
    loop.addLayer(paneRenderer)
    loopRef.current = loop

    // FPS tracking
    let frameCount = 0
    let lastTime = performance.now()
    loop.onFrame = () => {
      frameCount++
      const now = performance.now()
      const elapsed = now - lastTime
      if (elapsed >= 1000) {
        debugRef.current = { frameCount, lastFrameTime: now, fps: (frameCount * 1000) / elapsed }
        frameCount = 0
        lastTime = now
      }
    }

    loop.start()

    // — Interaction Runtime —
    const intRt = new InteractionRuntime()
    intRt.connect({
      setCursor: (cursor) => { canvas.style.cursor = cursor },
      requestRender: () => {},
      setHovered: () => {},
    })
    interactionRuntimeRef.current = intRt

    // — ResizeObserver —
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

        viewportRef.current?.setSize(w, h)

        const currentCtx = canvas.getContext('2d')
        if (currentCtx) {
          loop.setContext({
            ctx: currentCtx,
            viewport: viewportRef.current!,
            width: pw,
            height: ph,
            dpr,
            visibleData: candles.data,
          })
        }
        paneRenderer.resize(pw, ph, dpr)
      }
    })
    ro.observe(container)

    return () => {
      loop.stop()
      loop.destroy()
      ro.disconnect()
      canvas.remove()
      paneRenderer.destroy()
      syncRuntime.destroy()
      interactionRuntimeRef.current = null
      loopRef.current = null
      viewportRef.current = null
      canvasRef.current = null
      paneRendererRef.current = null
      syncRuntimeRef.current = null
      mainRuntimeRef.current = null
      rsiRuntimeRef.current = null
      macdRuntimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // — Sync data to candle renderer & indicator runtimes —
  useEffect(() => {
    // Recompute all indicator runtimes when data changes
    const mainRt = mainRuntimeRef.current
    const rsiRt = rsiRuntimeRef.current
    const macdRt = macdRuntimeRef.current
    if (mainRt) mainRt.recomputeAll(data)
    if (rsiRt) rsiRt.recomputeAll(data)
    if (macdRt) macdRt.recomputeAll(data)
  }, [data])

  // — Sync active indicators to correct runtimes —
  useEffect(() => {
    const mainRt = mainRuntimeRef.current
    const rsiRt = rsiRuntimeRef.current
    const macdRt = macdRuntimeRef.current
    if (!mainRt) return

    const desired = new Set(activeIndicators)

    const syncRuntimeIndicators = (rt: IndicatorRuntime, ids: Set<string>) => {
      // Remove instances not in the desired set
      for (const inst of rt.getAll()) {
        if (!ids.has(inst.definition.id)) {
          rt.remove(inst.instanceId)
        }
      }
      // Add missing instances
      for (const id of ids) {
        const exists = rt.getAll().some((i) => i.definition.id === id)
        if (!exists) {
          try { rt.add(id) } catch { /* not registered */ }
        }
      }
    }

    // Route: overlay → mainRt, RSI → rsiRt, MACD → macdRt
    const overlayIds = new Set<string>()
    const rsiIds = new Set<string>()
    const macdIds = new Set<string>()
    for (const id of desired) {
      if (id === 'RSI') rsiIds.add(id)
      else if (id === 'MACD') macdIds.add(id)
      else overlayIds.add(id)
    }

    syncRuntimeIndicators(mainRt, overlayIds)
    if (rsiRt) syncRuntimeIndicators(rsiRt, rsiIds)
    if (macdRt) syncRuntimeIndicators(macdRt, macdIds)
  }, [activeIndicators])

  // — Toggle grid —
  useEffect(() => {
    if (paneRendererRef.current) {
      paneRendererRef.current.showGrid = showGrid
    }
  }, [showGrid])

  // — Process drawing queue —
  useEffect(() => {
    // Drawing queue is processed via PaneRenderer's internal drawingRenderer
    // Same logic as before but we access it through paneRendererRef
    const pr = paneRendererRef.current
    if (!pr || data.length === 0 || drawingQueue.length === 0) return

    // Access drawingRenderer from... we don't have a ref for it.
    // For now, skip drawing queue processing in multi-pane mode.
    // The drawings are still rendered (opts.drawingRenderer renders in main pane).
    // This effect is needed to add new drawings to the drawing renderer's runtime.
    // We need a ref to the DrawingRenderer.
    
    // HACK: access via any
    const drawer = (pr as any).opts.drawingRenderer as DrawingRenderer | undefined
    if (!drawer) {
      resetDrawingQueue()
      return
    }
    const rt = drawer.runtime

    for (const item of drawingQueue) {
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
    resetDrawingQueue()
  }, [drawingQueue, data, resetDrawingQueue])

  // — Clear all drawings —
  useEffect(() => {
    if (drawingClearKey === 0) return
    const pr = paneRendererRef.current
    if (!pr) return
    const drawer = (pr as any).opts.drawingRenderer as DrawingRenderer | undefined
    if (drawer) drawer.runtime.clear()
  }, [drawingClearKey])

  // — Demo overlay data (same as before) —
  useEffect(() => {
    const pr = paneRendererRef.current
    if (!pr || data.length < 10) return
    const olRenderer = (pr as any).opts.overlayRenderer as OverlayRenderer | undefined
    if (!olRenderer) return
    const rt = olRenderer.runtime

    rt.clear()

    const priceHigh = Math.max(...data.map(d => d.high))
    const priceLow = Math.min(...data.map(d => d.low))
    const priceMid = (priceHigh + priceLow) / 2
    rt.add('price-marker', { price: priceHigh }, { label: `High ${priceHigh.toFixed(2)}`, color: '#ef9a9a' })
    rt.add('price-marker', { price: priceLow }, { label: `Low ${priceLow.toFixed(2)}`, color: '#a5d6a7' })
    rt.add('price-marker', { price: priceMid }, { label: `Mid ${priceMid.toFixed(2)}`, color: '#90caf9', lineWidth: 0.5 })

    const startIdx = Math.floor(data.length * 0.3)
    const endIdx = Math.floor(data.length * 0.7)
    rt.add('session-box', {}, {
      startTime: data[startIdx].timestamp, endTime: data[endIdx].timestamp,
      label: 'Tokyo Session', color: 'rgba(255, 183, 77, 0.08)',
    })

    const buyIdx = Math.floor(data.length * 0.4)
    rt.add('order-marker', { time: data[buyIdx].timestamp, price: data[buyIdx].low },
      { side: 'buy', quantity: 1.5, label: '1.5' })

    const entryIdx = Math.floor(data.length * 0.25)
    const exitIdx = Math.floor(data.length * 0.65)
    const entryPrice = data[entryIdx].close
    const exitPrice = data[exitIdx].close
    const pnl = ((exitPrice - entryPrice) / entryPrice) * 100
    rt.add('position-marker', { time: data[entryIdx].timestamp, price: data[entryIdx].close },
      { side: 'long', entryPrice, exitPrice, quantity: 1000, pnl, label: `+${pnl.toFixed(2)}%` })

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

    const lastCandle = data[data.length - 1]
    rt.add('alert-marker', { time: lastCandle.timestamp, price: lastCandle.high * 1.02 },
      { label: 'Resistance', color: '#ffa726' })
  }, [data])

  // — Pointer events (crosshair, pan, interaction) —

  const draggingRef = useRef(false)
  const dragStartRef = useRef({ clientX: 0, clientY: 0, offsetX: 0, offsetY: 0 })
  const interactionActiveRef = useRef(false)

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    const vp = viewportRef.current
    const syncRt = syncRuntimeRef.current
    const intRt = interactionRuntimeRef.current
    if (!canvas || !vp || !syncRt) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const pixelX = (e.clientX - rect.left) * dpr
    const pixelY = (e.clientY - rect.top) * dpr

    // Update shared crosshair
    syncRt.crosshair.setPosition(pixelX, vp.pixelToTime(pixelX))

    // Interaction route (drawing tool active or drag/resize gesture)
    if (intRt && (interactionActiveRef.current || intRt.toolMode !== 'select')) {
      // Access drawing renderer from PaneRenderer opts
      const pr = paneRendererRef.current
      const dr = pr ? (pr as any).opts.drawingRenderer : null
      const ctx = InteractionRuntime.makeHitContext(
        (t: number) => vp.timeToPixel(t),
        (p: number) => vp.priceToPixel(p),
      )
      intRt.router.pointerMove(
        { pixelX, pixelY, marketTime: vp.pixelToTime(pixelX), marketPrice: vp.pixelToPrice(pixelY), altKey: e.altKey, shiftKey: e.shiftKey },
        intRt.toolMode,
        dr?.runtime ?? intRt,
        intRt.hitTest,
        intRt.selection,
        intRt.drag,
        intRt.resize,
        intRt.cursor,
        ctx,
      )
      return
    }

    // Pan (via drag)
    if (draggingRef.current) {
      const dx = (e.clientX - dragStartRef.current.clientX) * dpr
      const dy = (e.clientY - dragStartRef.current.clientY) * dpr
      vp.setOffset(dragStartRef.current.offsetX + dx, dragStartRef.current.offsetY + dy)
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const vp = viewportRef.current
    const intRt = interactionRuntimeRef.current
    if (!vp) return

    if (intRt) {
      const dpr = window.devicePixelRatio || 1
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const pixelX = (e.clientX - rect.left) * dpr
      const pixelY = (e.clientY - rect.top) * dpr
      const ctx = InteractionRuntime.makeHitContext(
        (t: number) => vp.timeToPixel(t),
        (p: number) => vp.priceToPixel(p),
      )

      if (intRt.toolMode !== 'select') {
        const pr = paneRendererRef.current
        const dr = pr ? (pr as any).opts.drawingRenderer : null
        intRt.router.pointerDown(
          { pixelX, pixelY, marketTime: vp.pixelToTime(pixelX), marketPrice: vp.pixelToPrice(pixelY), altKey: e.altKey, shiftKey: e.shiftKey },
          intRt.toolMode, dr?.runtime ?? intRt, intRt.hitTest, intRt.selection,
          intRt.toolController, intRt.drag, intRt.resize, ctx,
        )
        interactionActiveRef.current = true
        return
      }

      // Select mode — hit-test first
      const pr = paneRendererRef.current
      const dr = pr ? (pr as any).opts.drawingRenderer : null
      const hit = intRt.hitTest.hitTest(pixelX, pixelY, dr?.runtime ?? intRt, ctx)
      if (hit) {
        intRt.router.pointerDown(
          { pixelX, pixelY, marketTime: vp.pixelToTime(pixelX), marketPrice: vp.pixelToPrice(pixelY), altKey: e.altKey, shiftKey: e.shiftKey },
          intRt.toolMode, dr?.runtime ?? intRt, intRt.hitTest, intRt.selection,
          intRt.toolController, intRt.drag, intRt.resize, ctx,
        )
        interactionActiveRef.current = true
        return
      }

      intRt.selection.clearSelection()
      intRt.selection.setActive(null)
    }

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
    if (intRt) intRt.router.pointerLeave(intRt.selection, intRt.cursor)
    if (syncRuntimeRef.current) syncRuntimeRef.current.hideCrosshair()
  }, [])

  // — Wheel zoom —
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

// — Main page —

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
        display: 'flex', flexDirection: 'column',
        width: '100vw', height: '100vh',
        background: '#1a1a2e', color: 'rgba(255,255,255,0.8)',
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

// — Standalone page wrapper —
export function ChartSandboxStandalone() {
  return (
    <MockCandleProvider>
      <ChartDemoPage />
    </MockCandleProvider>
  )
}
