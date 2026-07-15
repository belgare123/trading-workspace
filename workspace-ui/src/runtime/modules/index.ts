/**
 * Modules — Platform Module System (Architecture Constitution v1.1).
 *
 * Layer-3 modules follow the ClientModule contract:
 *   registerResources()  → widgets, providers, commands, search
 *   registerPresentation() → screens, presets, navigation (optional)
 *
 * @since 3.1.3.5
 */

export type { ClientModule, RuntimeContext } from './types'
export { WorkspaceFoundationModule } from './WorkspaceFoundationModule'

// Dashboard modules
export { OverviewModule } from '../dashboard/overview/OverviewModule'
export { MarketsModule } from '../dashboard/markets/MarketsModule'
export { SignalsModule } from '../dashboard/signals/SignalsModule'
export { PortfolioModule } from '../dashboard/portfolio/PortfolioModule'
export { StrategiesModule } from '../dashboard/strategies/StrategiesModule'
export { ReplayModule } from '../dashboard/replay/ReplayModule'
export { LearningModule } from '../dashboard/learning/LearningModule'
