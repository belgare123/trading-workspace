// ── Report Module — Barrel Export ──
//
// Sprint 3.5.5 — Reports & Visualization
//
// @since 3.5.5

// ── Types ──
export type {
  ChartPoint,
  ChartData,
  BarChartData,
  HistogramData,
  ScatterData,
  HeatmapData,
  SummaryMetrics,
  EquityAnalysisData,
  RiskMetrics,
  TradeAnalyticsData,
  TradeRow,
  OptimizationViewData,
  LeaderboardRow,
  SectionView,
  ReportView,
  ReportSources,
} from './types'

// ── Runtime ──
export { ReportRuntime } from './runtime/ReportRuntime'

// ── Sections ──
export { buildSummarySection } from './sections/SummarySection'
export { buildPerformanceSection } from './sections/PerformanceSection'
export { buildRiskSection } from './sections/RiskSection'
export { buildTradesSection } from './sections/TradesSection'
export { buildOptimizationSection } from './sections/OptimizationSection'
export { buildParametersSection } from './sections/ParametersSection'

// ── Charts ──
export {
  buildLineChart,
  buildBarChart,
  buildHistogram,
  buildScatter,
  buildHeatmap,
} from './charts/EquityChart'
export { buildDrawdownChart } from './charts/DrawdownChart'
export { buildBalanceChart } from './charts/BalanceChart'
export { buildExposureChart } from './charts/ExposureChart'
export { buildTradeDistributionChart } from './charts/TradeDistributionChart'
export { buildMonthlyReturnsChart } from './charts/MonthlyReturnsChart'
export { buildParameterHeatmap } from './charts/HeatmapChart'
export { buildParetoScatterChart } from './charts/ParetoScatterChart'

// ── Tables ──
export type { TradesTableData } from './tables/TradesTable'
export { buildTradesTable } from './tables/TradesTable'
export type { LeaderboardTableData } from './tables/LeaderboardTable'
export { buildLeaderboardTable } from './tables/LeaderboardTable'
export type { MetricsTableData } from './tables/MetricsTable'
export { buildMetricsTable } from './tables/MetricsTable'
export type { ParametersTableData } from './tables/ParametersTable'
export { buildParametersTable } from './tables/ParametersTable'

// ── Exporters ──
export { HtmlExporter } from './exporters/HtmlExporter'
export { CsvExporter } from './exporters/CsvExporter'
export { JsonExporter } from './exporters/JsonExporter'
export { PdfExporter } from './exporters/PdfExporter'

// ── Templates ──
export { buildDefaultReport } from './templates/DefaultReport'
export { buildOptimizationReportTemplate } from './templates/OptimizationReport'
export { buildWalkForwardReport } from './templates/WalkForwardReport'
