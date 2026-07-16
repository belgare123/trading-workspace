/**
 * types.ts — rendering layer contracts
 *
 * These interfaces define the rendering pipeline contract:
 *   IRenderLayer  — a single renderable layer (background, candles, overlay, …)
 *   IRenderContext— state passed to each layer every frame
 *   IRenderPass   — a pass descriptor (which layers in which order)
 *
 * @since 3.3.2
 */

import type { ChartViewport } from '../viewport/ChartViewport'
import type { OHLCV } from '../types'

export interface IRenderContext {
  /** Canvas 2D context (main layer or offscreen) */
  ctx: CanvasRenderingContext2D
  /** Current viewport with coordinate transforms */
  viewport: ChartViewport
  /** Canvas pixel dimensions (devicePixelRatio scaled) */
  width: number
  /** Canvas pixel height */
  height: number
  /** Device pixel ratio (for HiDPI) */
  dpr: number
  /** Optional data for the current viewport */
  visibleData?: OHLCV[]
}

export interface IRenderLayer {
  /** Unique layer id (e.g. 'candles', 'grid', 'crosshair') */
  readonly id: string
  /** Whether the layer is ready to render */
  ready: boolean
  /** Initialize the layer (create offscreen canvas, allocate resources) */
  initialize(context: IRenderContext): void
  /** Called every frame to render this layer */
  render(context: IRenderContext): void
  /** Called when the viewport changes (pan, zoom, resize) */
  updateViewport(context: IRenderContext): void
  /** Called when the container size changes */
  resize(width: number, height: number, dpr: number): void
  /** Cleanup and free resources */
  destroy(): void
}

export interface IRenderPass {
  /** Ordered list of layer ids to render in this pass */
  layers: string[]
  /** Optional background fill before rendering layers */
  clearColor?: string
}

export type LayerZIndex = 'background' | 'grid' | 'candles' | 'indicators' | 'drawings' | 'crosshair' | 'overlay'

export const RENDER_PASSES: Record<string, IRenderPass> = {
  main: {
    layers: ['background', 'grid', 'candles', 'indicators', 'drawings', 'crosshair'],
    clearColor: '#1a1a2e',
  },
  overlay: {
    layers: ['overlay'],
    clearColor: 'transparent',
  },
}
