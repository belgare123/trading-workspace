/**
 * index.ts — Workspace module barrel
 *
 * Layout Engine, Panel Runtime, and Dock Manager exports.
 * PanelContainer is intentionally re-exported twice (type + component)
 * but TypeScript handles this gracefully.
 *
 * @since 3.2.0
 */

export type {
  LayoutId,
  PanelId,
  WidgetRef,
  PanelPosition,
  TabSpec,
  Panel,
  PanelContainer as PanelContainerType,
} from './layout'

export {
  LAYOUT_VERSION,
  PERSISTENCE_VERSION,
  createWorkspaceLayout,
  createPanel,
  cloneWorkspaceLayout,
  clonePanel,
  getPanelById,
  addPanel,
  removePanel,
  updatePanelPosition,
  reorderPanels,
  LayoutEngine,
  layoutEngine,
  LayoutRegistry,
  layoutRegistry,
  serializeState,
  deserializeState,
  persistState,
  loadPersistedState,
  exportLayout,
  importLayout,
  createDefaultPersistenceState,
  validateLayout,
} from './layout'

export type {
  SplitDirection,
  LayoutChangeHandler,
  ValidationIssue,
  ValidationResult,
} from './layout'

// ── Panels ──

export type {
  PanelDefinition,
  PanelContext,
  PanelActions,
  PanelActionId,
  Size,
} from './panels'

export {
  PanelRegistry,
  panelRegistry,
  PanelRuntime,
  PanelContextProvider,
  usePanelRuntime,
  PanelHost,
  PanelContainer,
  PanelToolbar,
  PanelTabs,
  PANEL_ACTIONS,
  getDefaultPanelActions,
} from './panels'

export type {
  PanelContainerProps,
  PanelToolbarProps,
  PanelToolbarActions,
  PanelTabsProps,
  PanelActionMeta,
  PanelRuntimeOptions,
} from './panels'

// ── Docking ──

export type {
  DockZone,
  DockTarget,
  DockState,
  DockDragState,
  LayoutCommand,
  SplitCommand,
  DockCommand,
  FloatCommand,
  CloseCommand,
  MoveCommand,
  CommandResult,
  CommandValidation,
  Operation,
  OperationType,
} from './docking'

export {
  DOCK_EVENTS,
  EMPTY_DRAG_STATE,
  PointerTracker,
  hitTest,
  computePanelBounds,
  calculateZoneRect,
  snapPosition,
  DropResolver,
  clonePanels,
  OperationHistory,
  DockController,
  DockContextProvider,
  useDockController,
  DockManager,
  DockOverlay,
  DockPreview,
  DockZones,
  DragGhost,
} from './docking'

export type {
  PointerState,
  PointerTrackerOptions,
  HitTestOptions,
  PanelBounds,
  ZoneRect,
  SnapAlignment,
  OperationHistoryOptions,
  DockControllerOptions,
  DockControllerState,
} from './docking'

// ── Services ──

export { UndoManager, CommandRegistry, createWorkspaceCommands, useKeyboardBinding, SerializerService, WorkspaceServices, workspaceServices, WorkspaceServicesProvider, useWorkspaceServices } from './services'
export type { Command } from './services'

// ── Chart Studio ──

export {
  ChartRuntime,
  ChartHost,
  ChartRegistry,
  chartRegistry,
  ChartDefinitionRegistry,
  chartDefinitionRegistry,
  ChartRuntimeContext,
  useChartRuntime,
  ChartViewport,
  TimeScale,
  PriceScale,
  IndicatorRegistry,
  indicatorRegistry,
  ToolRegistry,
  toolRegistry,
  OverlayRegistry,
  overlayRegistry,
  CHART_TYPES,
  ChartError,
} from './chart'

// ── Risk Runtime (Sprint 4.7) ──

export {
  RiskRuntime,
  RiskRegistry,
  RiskPipeline,
  RiskEventBus,
  RiskViolationLog,
  RiskReport,
  createRiskDefinition,
  buildRiskContext,
  BUILTIN_RISK_RULES,
  MaxPositionSizeRule,
  MaxExposureRule,
  MaxDailyLossRule,
  MaxDrawdownRule,
  MaxOpenPositionsRule,
  MaxOrdersPerMinuteRule,
  TradingSessionRule,
  SymbolWhitelistRule,
  CooldownRule,
  KillSwitchRule,
  allow,
  modify,
  reject,
} from './risk'
export type {
  ChartConfig,
  ChartType,
  SymbolInfo,
  TimeInterval,
  ChartInstance,
  ChartDefinition,
  IndicatorMeta,
  ToolMeta,
  OverlayMeta,
  ChartChangeHandler,
  TimeScaleOptions,
  PriceScaleOptions,
  ViewportState,
  OHLCV,
} from './chart'
