/**
 * index.ts — Chart Studio barrel export
 *
 * @since 3.3.1
 */

// Core types
export {
  CHART_TYPES,
  ChartError,
} from './types'
export type {
  ChartType,
  SymbolInfo,
  TimeInterval,
  ScalePosition,
  TimeScaleOptions,
  PriceScaleOptions,
  ViewportState,
  ChartConfig,
  OHLCV,
  IndicatorMeta,
  ToolMeta,
  OverlayMeta,
  ChartDefinition,
} from './types'

// Runtime
export {
  ChartRuntime,
  ChartHost,
  ChartRuntimeContext,
  useChartRuntime,
  useChartRuntimeOrThrow,
  ChartDefinitionRegistry,
  chartDefinitionRegistry,
  ChartRegistry,
  chartRegistry,
} from './runtime'
export type {
  ChartChangeHandler,
  ChartHostProps,
  ChartInstance,
} from './runtime'

// Viewport
export {
  ChartViewport,
  TimeScale,
  PriceScale,
} from './viewport'
export type {
  PixelPoint,
  DataPoint,
  TimeTick,
  TimeLabelFormat,
  PriceTick,
} from './viewport'

// Registries
export {
  IndicatorRegistry,
  indicatorRegistry,
  ToolRegistry,
  toolRegistry,
  OverlayRegistry,
  overlayRegistry,
} from './registries'

// Rendering
export {
  CanvasLayer,
  RenderLoop,
  GridRenderer,
  AxisRenderer,
  CrosshairRenderer,
  CandleRenderer,
  RENDER_PASSES,
} from './rendering'
export type {
  FrameCallback,
  AxisRendererOptions,
  CrosshairPosition,
  CandleStyle,
  IRenderLayer,
  IRenderContext,
  IRenderPass,
  LayerZIndex,
} from './rendering'

// Overlay Engine
export {
  OverlayInstance,
  OverlayRuntime,
  OverlayRenderer,
} from './overlay'
export type {
  OverlayDefinition,
  OverlayCategory,
  OverlayPosition,
  OverlayRenderContext,
} from './overlay'
export { registerAllOverlayBuiltins } from './overlay/builtins'

// Composition Engine (multi-pane)
export {
  PaneRuntime,
  PaneLayout,
  PaneRenderer,
  SynchronizationRuntime,
  CrosshairSync,
  PriceScaleManager,
} from './composition'
export type {
  PaneState,
  PaneLayoutRow,
  PanePriceScale,
  CrosshairState,
  PaneRendererOptions,
} from './composition'
