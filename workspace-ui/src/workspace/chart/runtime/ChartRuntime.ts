/**
 * ChartRuntime.ts — lifecycle manager for a single chart
 *
 * Each chart instance gets its own ChartRuntime. It holds:
 *   - The chart config (symbol, interval, viewport, scales)
 *   - Viewport and scale state (pan, zoom)
 *   - References to registries (indicators, tools, overlays)
 *
 * The runtime does NOT render anything — it's a pure state manager.
 * Rendering is done by ChartHost (React component).
 *
 * @since 3.3.1
 */

import type { ChartConfig, ViewportState, TimeScaleOptions, PriceScaleOptions } from '../types'
import { chartRegistry } from './ChartRegistry'
import type { IndicatorRegistry } from '../registries/IndicatorRegistry'
import type { ToolRegistry } from '../registries/ToolRegistry'
import type { OverlayRegistry } from '../registries/OverlayRegistry'

export type ChartChangeHandler = (runtime: ChartRuntime) => void

export class ChartRuntime {
  /** Unique chart id (matches config.id) */
  readonly id: string

  /** Current chart configuration */
  config: ChartConfig

  /** Viewport state (pan offset + zoom) */
  viewport: ViewportState

  /** Time scale options */
  timeScale: TimeScaleOptions

  /** Price scale options */
  priceScale: PriceScaleOptions

  /** Active indicators for this chart (registered ids) */
  readonly activeIndicators: Set<string> = new Set()

  /** Active overlays for this chart */
  readonly activeOverlays: Set<string> = new Set()

  /** Active drawing tools for this chart */
  readonly activeTools: Set<string> = new Set()

  /** Callback fired on any state change */
  onChange: ChartChangeHandler | undefined

  /** External registry references */
  indicatorRegistry?: IndicatorRegistry
  toolRegistry?: ToolRegistry
  overlayRegistry?: OverlayRegistry

  constructor(config: ChartConfig) {
    this.id = config.id
    this.config = { ...config }
    this.viewport = { ...config.viewport }
    this.timeScale = { ...config.timeScale }
    this.priceScale = { ...config.priceScale }
  }

  // ── Lifecycle ──

  /** Initialize — register with chart registry */
  initialize(): void {
    chartRegistry.register(this.id, this.config)
  }

  /** Destroy — stop all activity, unregister */
  destroy(): void {
    this.activeIndicators.clear()
    this.activeOverlays.clear()
    this.activeTools.clear()
    this.onChange = undefined
    chartRegistry.unregister(this.id)
  }

  // ── Viewport ──

  /** Set viewport pan offset */
  panTo(offsetX: number, offsetY: number): void {
    this.viewport = { ...this.viewport, offsetX, offsetY }
    this._notify()
  }

  /** Set viewport zoom */
  zoomTo(zoomX: number, zoomY: number): void {
    this.viewport = { ...this.viewport, zoomX, zoomY }
    this._notify()
  }

  /** Reset viewport to default */
  resetViewport(): void {
    this.viewport = { offsetX: 0, offsetY: 0, zoomX: 1, zoomY: 1 }
    this._notify()
  }

  // ── Time scale ──

  /** Set visible time range */
  setTimeRange(from: number, to: number): void {
    this.timeScale = { ...this.timeScale, from, to }
    this._notify()
  }

  /** Shift visible time range by a delta (ms) */
  shiftTime(deltaMs: number): void {
    this.timeScale = {
      ...this.timeScale,
      from: this.timeScale.from + deltaMs,
      to: this.timeScale.to + deltaMs,
    }
    this._notify()
  }

  // ── Price scale ──

  /** Set fixed price range */
  setPriceRange(min?: number, max?: number): void {
    this.priceScale = { ...this.priceScale, fixedMin: min, fixedMax: max }
    this._notify()
  }

  /** Reset to auto price range */
  resetPriceRange(): void {
    this.priceScale = { ...this.priceScale, fixedMin: undefined, fixedMax: undefined }
    this._notify()
  }

  // ── Indicators / Tools / Overlays ──

  /** Add an indicator by id */
  addIndicator(id: string): void {
    this.activeIndicators.add(id)
    this._notify()
  }

  /** Remove an indicator */
  removeIndicator(id: string): void {
    this.activeIndicators.delete(id)
    this._notify()
  }

  /** Add a drawing tool */
  addTool(id: string): void {
    this.activeTools.add(id)
    this._notify()
  }

  /** Remove a drawing tool */
  removeTool(id: string): void {
    this.activeTools.delete(id)
    this._notify()
  }

  /** Add an overlay */
  addOverlay(id: string): void {
    this.activeOverlays.add(id)
    this._notify()
  }

  /** Remove an overlay */
  removeOverlay(id: string): void {
    this.activeOverlays.delete(id)
    this._notify()
  }

  // ── Internal ──

  private _notify(): void {
    this.onChange?.(this)
  }
}
