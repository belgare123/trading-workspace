import { DashboardPresetBuilder } from './DashboardPreset'
import { PresetRegistry } from './PresetRegistry'

/**
 * Default presets bundled with Runtime Kernel v3.0.
 *
 * The Executive Overview preset is defined in dashboard/screens/overview/
 * alongside its DataProviders and widget components.
 * This file registers the remaining 7 screens.
 */

/** Markets — dedicated market surveillance screen */
export const marketsPreset = new DashboardPresetBuilder('markets', 'Markets')
  .describe('Market surveillance: charts, depth, trades, liquidations')
  .addScreen('markets', 'Markets', '2-column', [
    'market-chart',
    'market-depth',
    'trades-feed',
    'market-stats',
  ])
  .build()

/** Signals — decision center */
export const signalsPreset = new DashboardPresetBuilder('signals', 'Signals')
  .describe('Signal center: confidence, risk, reason, execution')
  .addScreen('signals', 'Signals', 'single', [
    'signal-feed',
    'signal-detail',
  ])
  .build()

/** Portfolio — capital control */
export const portfolioPreset = new DashboardPresetBuilder('portfolio', 'Portfolio')
  .describe('Portfolio: balance, exposure, PnL, risk, drawdown')
  .addScreen('portfolio', 'Portfolio', '2-column', [
    'portfolio-summary',
    'portfolio-allocation',
    'portfolio-risk',
    'positions-table',
  ])
  .build()

/** Strategies — strategy runtime monitor */
export const strategiesPreset = new DashboardPresetBuilder('strategies', 'Strategies')
  .describe('Strategy runtime: signals, profit, Sharpe, CPU, events/sec')
  .addScreen('strategies', 'Strategies', '2-column', [
    'strategies-overview',
    'strategy-detail',
  ])
  .build()

/** Runtime — system devtools */
export const runtimePreset = new DashboardPresetBuilder('runtime', 'Runtime')
  .describe('Runtime console: services, plugins, events, profiler, playground')
  .addScreen('runtime', 'Runtime', '3-column', [
    'runtime-health',
    'services-list',
    'plugin-list',
  ])
  .build()

/** Replay — historical session player */
export const replayPreset = new DashboardPresetBuilder('replay', 'Replay')
  .describe('Replay Studio: timeline, bookmarks, speed, annotations')
  .addScreen('replay', 'Replay', 'single', [
    'replay-controls',
    'replay-timeline',
  ])
  .build()

/** Learning — AI/ML workspace (preview of Trading Lab) */
export const learningPreset = new DashboardPresetBuilder('learning', 'Learning')
  .describe('AI/ML: models, training, datasets, experiments, predictions')
  .addScreen('learning', 'Learning', '2-column', [
    'models-list',
    'training-status',
    'datasets-overview',
    'predictions-feed',
  ])
  .build()

/**
 * Register all built-in presets.
 * Call once at app startup.
 */
export function registerDefaultPresets(): void {
  const presets = [
    marketsPreset,
    signalsPreset,
    portfolioPreset,
    strategiesPreset,
    runtimePreset,
    replayPreset,
    learningPreset,
  ]

  for (const p of presets) {
    PresetRegistry.register(p)
  }

  if (import.meta.env.DEV) {
    console.log(`[DefaultPresets] Registered ${presets.length} presets`)
  }
}
