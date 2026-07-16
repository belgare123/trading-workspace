/**
 * ChartHost.tsx — React component that hosts a ChartRuntime + rendering pipeline
 *
 * Creates a ChartRuntime instance, provides it via context,
 * sets up the canvas rendering pipeline (RenderLoop, layers),
 * and manages resize/pointer events.
 *
 * @since 3.3.2 (rewritten with rendering pipeline integration)
 */

import { useEffect, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import { ChartRuntime } from './ChartRuntime'
import { ChartRuntimeContext } from './ChartContext'
import { chartRegistry } from './ChartRegistry'
import type { ChartConfig, OHLCV } from '../types'
import { RenderLoop } from '../rendering/RenderLoop'
import { CandleRenderer } from '../rendering/CandleRenderer'
import { GridRenderer } from '../rendering/GridRenderer'
import { AxisRenderer } from '../rendering/AxisRenderer'
import { CrosshairRenderer } from '../rendering/CrosshairRenderer'
import type { IRenderContext } from '../rendering/types'
import { RENDER_PASSES } from '../rendering/types'
import { ChartViewport } from '../viewport/ChartViewport'

export interface ChartHostProps {
  config: ChartConfig
  children?: ReactNode
  /** OHLCV data to render */
  data?: OHLCV[]
  /** Optional callback when runtime is created */
  onRuntimeReady?: (runtime: ChartRuntime) => void
}

/**
 * ChartHost — React component that hosts a ChartRuntime + rendering pipeline.
 *
 * Creates the runtime on mount, sets up a canvas with the render loop,
 * and connects all standard rendering layers (grid, candles, axes, crosshair).
 */
export function ChartHost({ config, children, data, onRuntimeReady }: ChartHostProps) {
  // Runtime (stable ref)
  const runtimeRef = useRef<ChartRuntime | null>(null)
  const renderLoopRef = useRef<RenderLoop | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Refs for render layers (stable across re-renders)
  const gridRef = useRef<GridRenderer | null>(null)
  const candleRef = useRef<CandleRenderer | null>(null)
  const axisRef = useRef<AxisRenderer | null>(null)
  const crosshairRef = useRef<CrosshairRenderer | null>(null)
  const viewportRef = useRef<ChartViewport | null>(null)

  // Pan drag state
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ clientX: 0, clientY: 0, offsetX: 0, offsetY: 0 })

  // ── Initialize on mount ──
  useEffect(() => {
    // Runtime
    const runtime = new ChartRuntime(config)
    runtime.initialize()
    runtimeRef.current = runtime
    chartRegistry.register(runtime.id, config)
    onRuntimeReady?.(runtime)

    // Viewport
    const viewport = new ChartViewport(config.viewport, config.timeScale, config.priceScale)
    viewportRef.current = viewport

    // Canvas
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0'
    container.appendChild(canvas)
    canvasRef.current = canvas

    // Render layers
    const grid = new GridRenderer()
    const candles = new CandleRenderer()
    const axes = new AxisRenderer()
    const crosshair = new CrosshairRenderer()
    gridRef.current = grid
    candleRef.current = candles
    axisRef.current = axes
    crosshairRef.current = crosshair

    // Render loop
    const loop = new RenderLoop([RENDER_PASSES.main])
    loop.addLayer(grid)
    loop.addLayer(candles)
    loop.addLayer(axes)
    loop.addLayer(crosshair)
    renderLoopRef.current = loop

    // Initialize all layers (share the same canvas context)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      const w = rect.width * dpr
      const h = rect.height * dpr

      const renderCtx: IRenderContext = {
        ctx,
        viewport,
        width: w,
        height: h,
        dpr,
        visibleData: data,
      }

      grid.initialize(renderCtx)
      candles.initialize(renderCtx)
      axes.initialize(renderCtx)
      crosshair.initialize(renderCtx)

      grid.resize(w, h, dpr)
      candles.resize(w, h, dpr)
      axes.resize(w, h, dpr)
      crosshair.resize(w, h, dpr)

      loop.setContext(renderCtx)
    }

    // Start loop
    loop.start()

    // ── Cleanup ──
    return () => {
      loop.stop()
      loop.destroy()
      runtime.destroy()
      chartRegistry.unregister(runtime.id)
      canvas.remove()
      runtimeRef.current = null
      renderLoopRef.current = null
      canvasRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync data on change ──
  useEffect(() => {
    if (candleRef.current) {
      candleRef.current.data = data
    }
  }, [data])

  // ── Sync config on change ──
  useEffect(() => {
    const r = runtimeRef.current
    if (!r) return
    r.config = { ...config }
    chartRegistry.updateConfig(r.id, config)
  }, [config])

  // ── Resize handling ──
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { inlineSize: w, blockSize: h } = entry.contentBoxSize[0]
        const dpr = window.devicePixelRatio || 1
        const pw = w * dpr
        const ph = h * dpr

        canvas.width = pw
        canvas.height = ph
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`

        const loop = renderLoopRef.current
        if (!loop) return

        // Resize all layers
        for (const layerId of ['grid', 'candles', 'axis', 'crosshair'] as const) {
          const layer = loop.getLayer(layerId)
          if (layer) layer.resize(pw, ph, dpr)
        }

        // Update viewport size
        const vp = viewportRef.current
        if (vp) vp.setSize(w, h)

        // Update context
        const ctx = canvas.getContext('2d')
        if (ctx && vp) {
          loop.setContext({
            ctx,
            viewport: vp,
            width: pw,
            height: ph,
            dpr,
            visibleData: candleRef.current?.data,
          })
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // ── Pointer events for crosshair and pan ──
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    const vp = viewportRef.current
    const ch = crosshairRef.current
    if (!canvas || !vp || !ch) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const pixelX = (e.clientX - rect.left) * dpr
    const pixelY = (e.clientY - rect.top) * dpr

    if (draggingRef.current) {
      // Pan
      const dx = (e.clientX - dragStartRef.current.clientX) * dpr
      const dy = (e.clientY - dragStartRef.current.clientY) * dpr
      vp.setOffset(
        dragStartRef.current.offsetX + dx,
        dragStartRef.current.offsetY + dy,
      )
    } else {
      // Crosshair
      ch.position = {
        pixelX,
        pixelY,
        timestamp: vp.pixelToTime(pixelX),
        price: vp.pixelToPrice(pixelY),
        visible: true,
      }
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const vp = viewportRef.current
    if (!vp) return
    draggingRef.current = true
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      offsetX: vp.viewport.offsetX,
      offsetY: vp.viewport.offsetY,
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false
  }, [])

  const handlePointerLeave = useCallback(() => {
    draggingRef.current = false
    const ch = crosshairRef.current
    if (ch) {
      ch.position = { ...ch.position, visible: false }
    }
  }, [])

  return (
    <ChartRuntimeContext.Provider value={runtimeRef.current}>
      <div
        ref={containerRef}
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {children}
      </div>
    </ChartRuntimeContext.Provider>
  )
}

// ── Re-exports for convenience ──

export { ChartRuntimeContext, useChartRuntime, useChartRuntimeOrThrow } from './ChartContext'
