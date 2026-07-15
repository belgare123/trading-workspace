/**
 * Runtime Benchmark Suite — index
 *
 * Re-exports all public API for the Benchmark subsystem.
 *
 * @since 2.0.0
 */

export { BenchmarkRunner } from './BenchmarkRunner'
export { BenchmarkRegistry } from './BenchmarkRegistry'
export { MetricsCollector, measure, generateLoad } from './MetricsCollector'
export { generateJsonReport, generateMarkdownReport, generateHtmlReport } from './ReportGenerator'
export type {
  BenchmarkConfig,
  BenchmarkMetrics,
  BenchmarkResult,
  BenchmarkCategory,
  BenchmarkScenario,
  RuntimeScore,
  BenchmarkReport,
} from './types'
export { CATEGORY_WEIGHTS, calculateGrade, formatOps, formatBytes } from './types'

// Import scenarios so they self-register
import './scenarios/EventBusBench'
import './scenarios/PluginBench'
import './scenarios/WidgetBench'
import './scenarios/SearchBench'
import './scenarios/LayoutBench'
import './scenarios/ReplayBench'
import './scenarios/CommandBench'
import './scenarios/StartupBench'
