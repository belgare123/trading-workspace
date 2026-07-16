// ── Built-in signals barrel ──
// Registers all built-in signals with SignalRegistry.
//
// Call registerAll() once at application startup to make
// all built-in signals available.
//
// @since 3.4.3

import { SignalRegistry } from '../registry/SignalRegistry'
import { CrossAboveSignal } from './CrossAboveSignal'
import { CrossBelowSignal } from './CrossBelowSignal'
import { RsiSignal } from './RsiSignal'
import { MacdSignal } from './MacdSignal'
import { BollingerSignal } from './BollingerSignal'
import { BreakoutSignal } from './BreakoutSignal'
import { VolumeSpikeSignal } from './VolumeSpikeSignal'
import { NewHighSignal } from './NewHighSignal'

/** Register all built-in signals with the global SignalRegistry */
export function registerAll(): void {
  const registry = SignalRegistry.getInstance()

  // Indicator-based signals
  registry.register(CrossAboveSignal)
  registry.register(CrossBelowSignal)
  registry.register(RsiSignal)
  registry.register(MacdSignal)
  registry.register(BollingerSignal)

  // Price action signals
  registry.register(BreakoutSignal)
  registry.register(NewHighSignal)

  // Volume signals
  registry.register(VolumeSpikeSignal)
}
