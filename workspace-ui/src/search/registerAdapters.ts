import { registerStrategiesAdapter } from './adapters/strategies'
import { registerPluginsAdapter } from './adapters/plugins'
import { registerEventsAdapter } from './adapters/events'
import { registerModelsAdapter } from './adapters/models'
import { registerOpportunitiesAdapter } from './adapters/opportunities'
import { registerReplayAdapter } from './adapters/replay'

/** Register all search adapters once at app startup. */
export function registerAllSearchAdapters(): void {
  registerStrategiesAdapter()
  registerPluginsAdapter()
  registerEventsAdapter()
  registerModelsAdapter()
  registerOpportunitiesAdapter()
  registerReplayAdapter()
}
