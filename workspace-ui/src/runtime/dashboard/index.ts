/**
 * Dashboard Runtime — entry point.
 *
 * Public API:
 * - ScreenRegistry: register/unregister/resolve workspace screens
 * - ScreenView: render a screen (bridges to DashboardShell for presets)
 * - DashboardRuntime.initialize(): bootstrap → validate → report
 * - DashboardShell (React component): mount with a preset ID
 * - PresetRegistry: register/unregister/resolve presets
 * - DataProviderRegistry: register/unregister/resolve data providers
 *
 * Architecture:
 * ```
 * Sidebar / Palette / Search / Layout Manager
 *   ↓
 * ScreenRegistry.get(id)         ← { id, title, preset, icon, ... }
 *   ↓
 * ScreenView / DashboardShell     ← resolves preset from PresetRegistry
 *   ↓
 * PresetRegistry.get(presetId)
 *   ↓
 * DashboardPreset { screens[] }
 *   ↓
 * ScreenRenderer
 *   ↓ (for each widget ID)
 * WidgetRegistry.get(id)
 *   ↓
 * WidgetDefinition.render()
 *   ↓
 * useDataProvider(providerId)     ← DataProviderRegistry → Runtime API
 * ```
 *
 * Every layer is a registry. Every layer is extensible without changing Workspace.
 */

/* ── ScreenRegistry (navigation) ── */

export { ScreenRegistry, ScreenView } from './screen'
export type { ScreenEntry } from './screen'
export { registerWorkspaceScreens } from './screen'

/* ── Dashboard Shell (renderer) ── */

export { DashboardShell } from './runtime/DashboardShell'

/* ── Validation & Bootstrap ── */

export { DashboardValidator } from './runtime/DashboardValidator'
export type { ValidationResult } from './runtime/DashboardValidator'

export { createRuntimeContext, setupDashboardEnvironment, validateDashboard } from './runtime/DashboardBootstrap'
export type { StartupReport } from './runtime/DashboardBootstrap'

export { DashboardRuntime } from './runtime/DashboardRuntime'
export type { SystemStartupReport } from './runtime/DashboardRuntime'

export { generateReport, reportToString, registerForDiagnostics } from './runtime/RuntimeDiagnostics'
export type { DiagnosticsReport, RegistryReport } from './runtime/RuntimeDiagnostics'

/* ── Public Runtime APIs ── */

export { ScreenRenderer } from './runtime/ScreenRenderer'
export { useDashboard } from './runtime/useDashboard'
export { useDataProvider } from './runtime/useDataProvider'

/* ── Presets ── */

export { PresetRegistry } from './presets/PresetRegistry'
export { DashboardPresetBuilder, validatePreset } from './presets/DashboardPreset'
export { registerDefaultPresets } from './presets/defaultPresets'
export { setupOverviewScreen } from './screens/overview/OverviewScreen'

/* ── Data Providers ── */

export { DataProviderRegistry } from './data/DataProviderRegistry'
export type { WidgetDataProvider } from './data/DataProviderRegistry'

/* ── Types ── */

export type {
  DashboardPreset, DashboardScreen, ScreenLayout,
} from './presets/types'

export type {
  KpiData,
  MarketAsset, MarketOverviewData,
  SignalDirection, SignalItem, LiveSignalsData,
  PortfolioAllocation, PortfolioSnapshotData,
  OpportunityItem, OpportunitiesData,
  StrategyInfo, StrategyStatusData,
  ServiceHealth, RuntimeHealthData,
  TimelineEntry, TimelineData,
  NotificationItem, NotificationsData,
} from './data/types'
